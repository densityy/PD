import { supabase } from '@/lib/supabase';
import type { Clinic, ClinicPrice } from '@/types/pia';

interface StoredClinicPrice {
    google_place_id: string;
    clinic_name: string;
    price_from: number | null;
    price_to: number | null;
    currency: string;
    source_type:
    | 'clinic_submitted'
    | 'clinic_website'
    | 'manual'
    | 'estimated';
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
    toothache: 'emergency_consultation',
    checkup: 'examination',
    emergency: 'emergency_consultation',
    cosmetic: 'teeth_whitening',
    broken_tooth: 'filling',
    wisdom_tooth: 'wisdom_tooth',
    root_canal: 'root_canal',
    cleaning: 'dental_cleaning',
    crown: 'crown',
};

export function getTreatmentCode(reason?: string) {
    if (!reason) {
        return undefined;
    }

    return REASON_TO_TREATMENT[reason];
}

export async function addPricesToClinics(
    clinics: Clinic[],
    reason?: string,
): Promise<Clinic[]> {
    const treatmentCode = getTreatmentCode(reason);

    if (!treatmentCode || clinics.length === 0) {
        return clinics;
    }

    const { data, error } =
        await supabase.functions.invoke<PriceFunctionResponse>(
            'get-clinic-prices',
            {
                body: {
                    googlePlaceIds: clinics.map((clinic) => clinic.id),
                    treatmentCode,
                },
            },
        );

    if (error) {
        console.error('Clinic price lookup failed:', error);

        // Clinic search should still work if price lookup fails.
        return clinics;
    }

    console.log('PRICE LOOKUP:', {
        treatmentCode,
        data,
    });

    if (!data?.treatment || !Array.isArray(data.prices)) {
        return clinics;
    }

    const treatment = data.treatment;

    const pricesByClinicId = new Map<string, StoredClinicPrice>(
        data.prices.map((price) => [
            price.google_place_id,
            price,
        ]),
    );

    return clinics.map((clinic): Clinic => {
        const storedPrice = pricesByClinicId.get(clinic.id);

        if (!storedPrice) {
            return clinic;
        }

        const clinicPrice: ClinicPrice = {
            treatment: treatment.name,
            priceFrom: storedPrice.price_from ?? undefined,
            priceTo: storedPrice.price_to ?? undefined,
            currency: 'NOK',
            sourceType: storedPrice.source_type,
            sourceUrl: storedPrice.source_url ?? undefined,
            verifiedAt: storedPrice.verified_at ?? undefined,
        };

        return {
            ...clinic,
            prices: [clinicPrice],
        };
    });
}