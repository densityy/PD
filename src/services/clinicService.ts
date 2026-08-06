import { supabase } from '@/lib/supabase';
import { addPricesToClinics } from '@/services/priceService';
import type { Clinic } from '@/types/pia';

export interface ClinicSearchOptions {
    location: string;
    treatment?: string;
    openNow?: boolean;
    maxResults?: number;
}

export interface ClinicSearchResult {
    clinics: Clinic[];
    source: 'live' | 'cached' | 'mock';
}

interface ClinicSearchFunctionResponse {
    location: string;
    source: string;
    clinics: Clinic[];
}

export async function searchClinics(
    options: ClinicSearchOptions,
): Promise<ClinicSearchResult> {
    const location = options.location.trim();

    if (!location) {
        throw new Error('Location is required.');
    }

    const { data, error } =
        await supabase.functions.invoke<ClinicSearchFunctionResponse>(
            'search-clinics',
            {
                body: {
                    location,
                    maxResults: options.maxResults ?? 5,
                },
            },
        );

    if (error) {
        console.error('Clinic search error:', error);
        throw new Error('Kunne ikke søke etter klinikker.');
    }

    if (!data?.clinics || !Array.isArray(data.clinics)) {
        throw new Error('Klinikksøket returnerte ugyldige data.');
    }

    const clinicsWithPrices = await addPricesToClinics(
        data.clinics,
        options.treatment,
    );

    return {
        source: 'live',
        clinics: clinicsWithPrices,
    };
}