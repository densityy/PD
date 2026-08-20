import { supabase } from "@/lib/supabase";

import type { Clinic, ClinicPrice } from "@/types/pia";

interface StoredClinicPrice {
  google_place_id: string;
  clinic_name: string;

  price_from: number | null;
  price_to: number | null;

  currency: string;

  source_type: "clinic_submitted" | "clinic_website" | "manual" | "estimated";

  source_url: string | null;
  verified_at: string | null;
}

interface PriceFunctionResponse {
  treatment: {
    code: string;
    name: string;
  } | null;

  prices: StoredClinicPrice[];
}

const REASON_TO_TREATMENT: Record<string, string> = {
  toothache: "emergency_consultation",

  checkup: "examination",

  examination: "examination",

  emergency: "emergency_consultation",

  emergency_consultation: "emergency_consultation",

  cosmetic: "teeth_whitening",

  teeth_whitening: "teeth_whitening",

  broken_tooth: "filling",

  filling: "filling",

  wisdom_tooth: "wisdom_tooth",

  root_canal: "root_canal",

  cleaning: "dental_cleaning",

  dental_cleaning: "dental_cleaning",

  crown: "crown",

  tooth_extraction: "tooth_extraction",

  implant: "implant",
};

export function getTreatmentCode(reason?: string) {
  if (!reason) {
    return undefined;
  }

  const normalized = reason.trim();

  return REASON_TO_TREATMENT[normalized] ?? normalized;
}

function normalizeId(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export async function addPricesToClinics(
  clinics: Clinic[],
  reason?: string,
): Promise<Clinic[]> {
  const treatmentCode = getTreatmentCode(reason);

  if (!treatmentCode || clinics.length === 0) {
    return clinics;
  }

  const googlePlaceIds = clinics
    .map((clinic) => clinic.id?.trim())
    .filter((id): id is string => Boolean(id));

  const { data, error } =
    await supabase.functions.invoke<PriceFunctionResponse>(
      "get-clinic-prices",
      {
        body: {
          googlePlaceIds,
          treatmentCode,
        },
      },
    );

  if (error) {
    console.error("Clinic price lookup failed:", error);

    /*
     * Clinic search still works
     * even if price lookup fails.
     */
    return clinics;
  }

  if (!data?.treatment || !Array.isArray(data.prices)) {
    return clinics;
  }

  const treatment = data.treatment;

  /*
   * Google Place ID is authoritative.
   *
   * DO NOT match prices by clinic name.
   *
   * Different branches can have identical
   * names but different prices.
   */
  const pricesByClinicId = new Map<string, StoredClinicPrice>();

  for (const price of data.prices) {
    const normalizedId = normalizeId(price.google_place_id);

    if (!normalizedId) {
      continue;
    }

    pricesByClinicId.set(normalizedId, price);
  }

  const clinicsWithPrices = clinics.map((clinic): Clinic => {
    const clinicId = normalizeId(clinic.id);

    const storedPrice = pricesByClinicId.get(clinicId);

    /*
     * No exact Google Place ID match.
     *
     * Never borrow another branch's
     * price just because the name matches.
     */
    if (!storedPrice) {
      return {
        ...clinic,
        prices: [],
      };
    }

    const hasAnyPrice =
      storedPrice.price_from !== null || storedPrice.price_to !== null;

    if (!hasAnyPrice) {
      return {
        ...clinic,
        prices: [],
      };
    }

    const clinicPrice: ClinicPrice = {
      treatment: treatment.name,

      priceFrom: storedPrice.price_from ?? undefined,

      priceTo: storedPrice.price_to ?? undefined,

      currency: "NOK",

      sourceType: storedPrice.source_type,

      sourceUrl: storedPrice.source_url ?? undefined,

      verifiedAt: storedPrice.verified_at ?? undefined,
    };

    return {
      ...clinic,

      prices: [clinicPrice],
    };
  });

  return clinicsWithPrices;
}
