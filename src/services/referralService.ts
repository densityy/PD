import { supabase } from '@/lib/supabase';
import type { CollectedPatientData } from '@/types/pia';

const REASON_LABELS: Record<string, string> = {
    toothache: 'Tannpine',
    checkup: 'Rutinekontroll',
    cosmetic: 'Estetisk tannbehandling',
    emergency: 'Akutt behov',
    other: 'Annet',
};

export function getReasonLabel(reason?: string) {
    if (!reason) {
        return 'Tannhelse';
    }

    return REASON_LABELS[reason] ?? 'Tannhelse';
}

export async function savePatientReferral(data: CollectedPatientData) {
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

    const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .insert({
            patient_name: data.patientName,
            patient_phone: data.patientPhone,
            status: 'referred',
            referral_clinic: data.selectedClinic.name,
            referral_reason: reasonLabel,
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
        })
        .select('id')
        .single();

    if (conversationError) {
        throw conversationError;
    }

    const { error: referralError } = await supabase
        .from('patient_referrals')
        .insert({
            conversation_id: conversation.id,
            patient_name: data.patientName,
            clinic_name: data.selectedClinic.name,
            clinic_id: data.selectedClinic.id || null,
            reason: reasonLabel,
            status: 'confirmed',
        });

    if (referralError) {
        throw referralError;
    }

    return {
        conversationId: conversation.id,
        clinic: data.selectedClinic,
        reasonLabel,
    };
}
