import { supabase } from "@/lib/supabase";
import {
  addPricesToClinics,
  getTreatmentCode,
} from "@/services/priceService";
import type { Clinic } from "@/types/pia";

const QUEUE_CONCURRENCY = 3;
const PRICE_RECHECK_DELAYS_MS = [3000, 6000, 10000, 15000];

export interface PriceRefreshUpdate {
  clinics: Clinic[];
  missingClinicIds: Set<string>;
  complete: boolean;
}

interface RefreshClinicPricesOptions {
  clinics: Clinic[];
  treatment: string;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
  onUpdate?: (update: PriceRefreshUpdate) => void;
}

function clinicHasPrice(clinic: Clinic, treatmentCode?: string) {
  if (!treatmentCode) return Boolean(clinic.prices?.length);
  return Boolean(
    clinic.prices?.some((price) => price.treatmentCode === treatmentCode),
  );
}

function canContinue(
  signal?: AbortSignal,
  isCurrent?: () => boolean,
) {
  return !signal?.aborted && (isCurrent?.() ?? true);
}

async function queueClinic(
  clinic: Clinic,
  treatmentCode: string,
) {
  const { error } = await supabase.functions.invoke(
    "queue-clinic-price-refresh",
    {
      body: {
        googlePlaceId: clinic.id,
        clinicName: clinic.name,
        clinicCity: clinic.city ?? null,
        sourceUrl: clinic.priceListUrl ?? null,
        websiteUrl: clinic.website ?? null,
        treatmentCode,
        countryCode: "NO",
      },
    },
  );

  if (error) {
    throw error;
  }

  return true;
}

async function queueWithLimit(
  clinics: Clinic[],
  treatmentCode: string,
  signal?: AbortSignal,
  isCurrent?: () => boolean,
) {
  let nextIndex = 0;
  const queuedClinicIds = new Set<string>();

  const workers = Array.from(
    { length: Math.min(QUEUE_CONCURRENCY, clinics.length) },
    async () => {
      while (
        nextIndex < clinics.length &&
        canContinue(signal, isCurrent)
      ) {
        const clinic = clinics[nextIndex];
        nextIndex += 1;

        try {
          await queueClinic(clinic, treatmentCode);
          queuedClinicIds.add(clinic.id);
        } catch (error) {
          console.error(`Could not queue a price refresh for ${clinic.name}:`, error);
        }
      }
    },
  );

  await Promise.all(workers);
  return queuedClinicIds;
}

function wait(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(resolve, delayMs);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutId);
        resolve();
      },
      { once: true },
    );
  });
}

function createUpdate(
  clinics: Clinic[],
  complete: boolean,
  treatmentCode?: string,
): PriceRefreshUpdate {
  return {
    clinics,
    missingClinicIds: new Set(
      clinics
        .filter((clinic) => !clinicHasPrice(clinic, treatmentCode))
        .map((clinic) => clinic.id),
    ),
    complete,
  };
}

export async function refreshClinicPrices({
  clinics,
  treatment,
  signal,
  isCurrent,
  onUpdate,
}: RefreshClinicPricesOptions) {
  if (!canContinue(signal, isCurrent)) {
    return clinics;
  }

  const latestClinics = clinics;
  const treatmentCode = getTreatmentCode(treatment) ?? treatment;
  const missingClinics = latestClinics.filter(
    (clinic) => !clinicHasPrice(clinic, treatmentCode),
  );

  if (missingClinics.length === 0) {
    onUpdate?.(createUpdate(latestClinics, true, treatmentCode));
    return latestClinics;
  }

  /*
   * Price discovery must never hold up the user-facing search. Queue the
   * Norway-only refresh in the background and return the cached result now.
   * A later search will automatically receive newly indexed prices.
   */
  const queuedClinicIds = await queueWithLimit(
    missingClinics,
    treatmentCode,
    signal,
    isCurrent,
  );

  if (queuedClinicIds.size === 0 || !canContinue(signal, isCurrent)) {
    onUpdate?.(createUpdate(latestClinics, true, treatmentCode));
    return latestClinics;
  }

  let refreshedClinics = latestClinics;
  onUpdate?.(createUpdate(refreshedClinics, false, treatmentCode));

  for (const delayMs of PRICE_RECHECK_DELAYS_MS) {
    await wait(delayMs, signal);
    if (!canContinue(signal, isCurrent)) {
      return refreshedClinics;
    }

    refreshedClinics = await addPricesToClinics(
      refreshedClinics,
      treatmentCode,
    );

    const update = createUpdate(refreshedClinics, false, treatmentCode);
    onUpdate?.(update);

    if (update.missingClinicIds.size === 0) {
      onUpdate?.(createUpdate(refreshedClinics, true, treatmentCode));
      return refreshedClinics;
    }
  }

  onUpdate?.(createUpdate(refreshedClinics, true, treatmentCode));
  return refreshedClinics;
}
