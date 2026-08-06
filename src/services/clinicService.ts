import type { Clinic } from '@/types/pia';

export interface ClinicSearchOptions {
    location: string;
    treatment?: string;
    openNow?: boolean;
}

export interface ClinicSearchResult {
    clinics: Clinic[];
    source: 'live' | 'cached' | 'mock';
}

export async function searchClinics(
    options: ClinicSearchOptions,
): Promise<ClinicSearchResult> {
    console.log('Clinic search:', options);

    // Temporary test data.
    // This will be replaced by the Supabase backend and real clinic search.
    return {
        source: 'mock',
        clinics: [
            {
                id: 'test-clinic-1',
                name: `Testklinikk i ${options.location}`,
                address: 'Testveien 1',
                city: options.location,
                rating: 4.7,
                reviewCount: 124,
                isPartner: false,
                isVerified: false,
                prices: [
                    {
                        treatment: options.treatment ?? 'Undersøkelse',
                        priceFrom: 900,
                        priceTo: 1400,
                        currency: 'NOK',
                        sourceType: 'estimated',
                    },
                ],
            },
        ],
    };
}