import { supabase } from '@/lib/supabase';
import type {
    Clinic,
    ClinicPrice,
} from '@/types/pia';

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

const REASON_TO_TREATMENT:
    Record<string, string> = {
    toothache:
        'emergency_consultation',

    checkup:
        'examination',

    examination:
        'examination',

    emergency:
        'emergency_consultation',

    emergency_consultation:
        'emergency_consultation',

    cosmetic:
        'teeth_whitening',

    teeth_whitening:
        'teeth_whitening',

    broken_tooth:
        'filling',

    filling:
        'filling',

    wisdom_tooth:
        'wisdom_tooth',

    root_canal:
        'root_canal',

    cleaning:
        'dental_cleaning',

    dental_cleaning:
        'dental_cleaning',

    crown:
        'crown',

    tooth_extraction:
        'tooth_extraction',

    implant:
        'implant',
};

export function getTreatmentCode(
    reason?: string,
) {
    if (!reason) {
        return undefined;
    }

    /*
     * Support both Pia reason names such as
     * "checkup" and canonical treatment codes
     * such as "root_canal".
     */
    return (
        REASON_TO_TREATMENT[
        reason.trim()
        ] ?? reason.trim()
    );
}

function normalizeId(
    value?: string | null,
) {
    return (
        value
            ?.trim()
            .toLowerCase() ??
        ''
    );
}

function normalizeName(
    value?: string | null,
) {
    return (
        value
            ?.trim()
            .toLowerCase()
            .replace(/\s+/g, ' ') ??
        ''
    );
}

export async function addPricesToClinics(
    clinics: Clinic[],
    reason?: string,
): Promise<Clinic[]> {
    const treatmentCode =
        getTreatmentCode(reason);

    if (
        !treatmentCode ||
        clinics.length === 0
    ) {
        return clinics;
    }

    const googlePlaceIds =
        clinics
            .map(
                (clinic) =>
                    clinic.id?.trim(),
            )
            .filter(
                (
                    id,
                ): id is string =>
                    Boolean(id),
            );

    const {
        data,
        error,
    } =
        await supabase.functions.invoke<PriceFunctionResponse>(
            'get-clinic-prices',
            {
                body: {
                    googlePlaceIds,
                    treatmentCode,
                },
            },
        );

    if (error) {
        console.error(
            'Clinic price lookup failed:',
            error,
        );

        /*
         * Clinic Finder should still work
         * even if price lookup fails.
         */
        return clinics;
    }

    console.log(
        'PRICE LOOKUP:',
        {
            treatmentCode,
            requestedIds:
                googlePlaceIds,
            data,
        },
    );

    if (
        !data?.treatment ||
        !Array.isArray(
            data.prices,
        )
    ) {
        return clinics;
    }

    const treatment =
        data.treatment;

    /*
     * Exact Google Place ID lookup.
     */
    const pricesByClinicId =
        new Map<
            string,
            StoredClinicPrice
        >();

    /*
     * Clinic-name fallback.
     *
     * We normally match using Google Place ID.
     * The name fallback protects us against
     * formatting/whitespace differences in
     * existing imported records.
     */
    const pricesByClinicName =
        new Map<
            string,
            StoredClinicPrice
        >();

    for (
        const price of
        data.prices
    ) {
        const normalizedId =
            normalizeId(
                price.google_place_id,
            );

        if (normalizedId) {
            pricesByClinicId.set(
                normalizedId,
                price,
            );
        }

        const normalizedName =
            normalizeName(
                price.clinic_name,
            );

        if (normalizedName) {
            pricesByClinicName.set(
                normalizedName,
                price,
            );
        }
    }

    const clinicsWithPrices =
        clinics.map(
            (
                clinic,
            ): Clinic => {
                const clinicId =
                    normalizeId(
                        clinic.id,
                    );

                const clinicName =
                    normalizeName(
                        clinic.name,
                    );

                const storedPrice =
                    pricesByClinicId.get(
                        clinicId,
                    ) ??
                    pricesByClinicName.get(
                        clinicName,
                    );

                if (!storedPrice) {
                    return {
                        ...clinic,
                        prices: [],
                    };
                }

                const clinicPrice:
                    ClinicPrice = {
                    treatment:
                        treatment.name,

                    priceFrom:
                        storedPrice.price_from ??
                        undefined,

                    priceTo:
                        storedPrice.price_to ??
                        undefined,

                    currency: 'NOK',

                    sourceType:
                        storedPrice.source_type,

                    sourceUrl:
                        storedPrice.source_url ??
                        undefined,

                    verifiedAt:
                        storedPrice.verified_at ??
                        undefined,
                };

                console.log(
                    'PRICE MATCH:',
                    {
                        clinic:
                            clinic.name,

                        clinicId:
                            clinic.id,

                        storedClinic:
                            storedPrice.clinic_name,

                        storedId:
                            storedPrice.google_place_id,

                        priceFrom:
                            clinicPrice.priceFrom,

                        priceTo:
                            clinicPrice.priceTo,
                    },
                );

                return {
                    ...clinic,
                    prices: [
                        clinicPrice,
                    ],
                };
            },
        );

    console.log(
        'PRICE MATCH RESULT:',
        clinicsWithPrices.map(
            (clinic) => ({
                clinic:
                    clinic.name,

                id:
                    clinic.id,

                prices:
                    clinic.prices,
            }),
        ),
    );

    return clinicsWithPrices;
}