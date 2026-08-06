import { supabase } from '@/lib/supabase';
import type { CollectedPatientData } from '@/types/pia';

const REASON_LABELS: Record<string, string> = {
    toothache: 'Tannpine',
    checkup: 'Rutinekontroll',
    cosmetic: 'Estetisk tannbehandling',
    emergency: 'Akutt behov',
    broken_tooth: 'Knekt tann',
    wisdom_tooth: 'Visdomstann',
    root_canal: 'Rotfylling',
    cleaning: 'Tannrens',
    other: 'Annet',
};

export function getReasonLabel(reason?: string) {
    if (!reason) {
        return 'Tannhelse';
    }

    return REASON_LABELS[reason] ?? 'Tannhelse';
}

export async function savePatientReferral(
    data: CollectedPatientData,
) {
    if (!data.patientName) {
        throw new Error('Patient name is missing.');
    }

    if (!data.patientPhone) {
        throw new Error('Patient phone is missing.');
    }

    if (!data.selectedClinic) {
        throw new Error('Selected clinic is missing.');
    }

    const reasonLabel = getReasonLabel(data.reason);

    const { data: result, error } =
        await supabase.functions.invoke('create-referral', {
            body: {
                patientName: data.patientName,
                patientPhone: data.patientPhone,
                clinicName: data.selectedClinic.name,
                clinicGooglePlaceId: data.selectedClinic.id,
                reason: reasonLabel,
            },
        });

    if (error) {
        console.error('Create referral function error:', error);
        throw new Error('Kunne ikke lagre forespørselen.');
    }

    if (!result?.conversationId || !result?.referralId) {
        console.error('Invalid create-referral response:', result);
        throw new Error('Serveren returnerte ugyldige data.');
    }

    return {
        conversationId: result.conversationId as string,
        referralId: result.referralId as string,
        clinic: data.selectedClinic,
        reasonLabel,
    };
}