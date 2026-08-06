import { supabase } from '@/lib/supabase';
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

export async function searchClinics(
    options: ClinicSearchOptions,
): Promise<ClinicSearchResult> {
    const location = options.location.trim();

    if (!location) {
        throw new Error('Location is required.');
    }

    const { data, error } = await supabase.functions.invoke(
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

    return {
        source: 'live',
        clinics: data.clinics as Clinic[],
    };
}