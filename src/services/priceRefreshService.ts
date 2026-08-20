import { supabase } from "@/lib/supabase";
import { addPricesToClinics, getTreatmentCode } from "@/services/priceService";
import type { Clinic } from "@/types/pia";

const DEFAULT_POLL_DELAY_MS = 2500;
// New clinic sources can take longer than a cached lookup because the
// background worker may need to discover and parse an external price list.
const DEFAULT_MAX_POLLS = 24;
const QUEUE_CONCURRENCY = 3;

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
  maxPolls?: number;
  pollDelayMs?: number;
  onUpdate?: (update: PriceRefreshUpdate) => void;
}

function clinicHasPrice(clinic: Clinic) {
  return Boolean(clinic.prices?.length);
}

function canContinue(
  signal?: AbortSignal,
  isCurrent?: () => boolean,
) {
  return !signal?.aborted && (isCurrent?.() ?? true);
}

function wait(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timeout = window.setTimeout(resolve, milliseconds);

    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
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
      },
    },
  );

  if (error) {
    throw error;
  }
}

async function queueWithLimit(
  clinics: Clinic[],
  treatmentCode: string,
  signal?: AbortSignal,
  isCurrent?: () => boolean,
) {
  let nextIndex = 0;

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
        } catch (error) {
          console.error(`Could not queue a price refresh for ${clinic.name}:`, error);
        }
      }
    },
  );

  await Promise.all(workers);
}

function createUpdate(clinics: Clinic[], complete: boolean): PriceRefreshUpdate {
  return {
    clinics,
    missingClinicIds: new Set(
      clinics
        .filter((clinic) => !clinicHasPrice(clinic))
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
  maxPolls = DEFAULT_MAX_POLLS,
  pollDelayMs = DEFAULT_POLL_DELAY_MS,
  onUpdate,
}: RefreshClinicPricesOptions) {
  if (!canContinue(signal, isCurrent)) {
    return clinics;
  }

  let latestClinics = clinics;
  const missingClinics = latestClinics.filter(
    (clinic) => !clinicHasPrice(clinic),
  );

  if (missingClinics.length === 0) {
    onUpdate?.(createUpdate(latestClinics, true));
    return latestClinics;
  }

  const treatmentCode = getTreatmentCode(treatment) ?? treatment;

  await queueWithLimit(
    missingClinics,
    treatmentCode,
    signal,
    isCurrent,
  );

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    await wait(pollDelayMs, signal);

    if (!canContinue(signal, isCurrent)) {
      return latestClinics;
    }

    try {
      latestClinics = await addPricesToClinics(
        latestClinics,
        treatment,
      );

      if (!canContinue(signal, isCurrent)) {
        return latestClinics;
      }

      const update = createUpdate(latestClinics, false);
      onUpdate?.(update);

      if (update.missingClinicIds.size === 0) {
        onUpdate?.(createUpdate(latestClinics, true));
        return latestClinics;
      }
    } catch (error) {
      console.error("Could not refresh clinic prices:", error);
    }
  }

  onUpdate?.(createUpdate(latestClinics, true));
  return latestClinics;
}
