import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/types/pia';

export type PiaAction =
    | 'search_clinics'
    | 'compare_prices'
    | 'check_public_eligibility'
    | 'ask_follow_up'
    | 'show_emergency_advice'
    | 'none';

export type PiaTreatment =
    | 'toothache'
    | 'checkup'
    | 'emergency'
    | 'cosmetic'
    | 'broken_tooth'
    | 'wisdom_tooth'
    | 'root_canal'
    | 'cleaning'
    | 'other';

export interface PiaExtractedData {
    location: string | null;
    treatment: PiaTreatment | null;
    age: number | null;
    severity: number | null;
    duration: string | null;
    wantsClinicSearch: boolean;
    wantsPriceComparison: boolean;
    asksAboutPublicEligibility: boolean;
    wantsPublicClinics: boolean;
    wantsPrivateClinics: boolean;
    emergencyWarning: boolean;
}

export interface PiaResponse {
    message: string;
    extracted: PiaExtractedData;
    actions: PiaAction[];
}

const EMPTY_EXTRACTED_DATA: PiaExtractedData = {
    location: null,
    treatment: null,
    age: null,
    severity: null,
    duration: null,
    wantsClinicSearch: false,
    wantsPriceComparison: false,
    asksAboutPublicEligibility: false,
    wantsPublicClinics: false,
    wantsPrivateClinics: false,
    emergencyWarning: false,
};

function createFallbackResponse(message: string): PiaResponse {
    return {
        message,
        extracted: EMPTY_EXTRACTED_DATA,
        actions: ['none'],
    };
}

export async function sendMessageToPia(
    message: string,
    history: ChatMessage[],
): Promise<PiaResponse> {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
        return createFallbackResponse(
            'Skriv gjerne litt om hva du trenger hjelp med.',
        );
    }

    const cleanHistory = history
        .filter((item) => item.text.trim().length > 0)
        .slice(-16)
        .map((item) => ({
            sender: item.sender,
            text: item.text,
        }));

    const { data, error } =
        await supabase.functions.invoke<PiaResponse>('pia-ai', {
            body: {
                message: trimmedMessage,
                history: cleanHistory,
            },
        });

    if (error) {
        console.error('Pia AI function error:', error);

        return createFallbackResponse(
            'Beklager, jeg klarte ikke å behandle meldingen akkurat nå. Prøv gjerne igjen.',
        );
    }

    if (
        !data ||
        typeof data.message !== 'string' ||
        !data.extracted ||
        !Array.isArray(data.actions)
    ) {
        console.error('Invalid Pia AI response:', data);

        return createFallbackResponse(
            'Beklager, jeg fikk et ugyldig svar. Prøv gjerne å skrive meldingen på nytt.',
        );
    }

    return data;
}