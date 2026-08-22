import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface CreateReferralRequest {
  patientName: string;
  patientPhone: string;
  clinicName: string;
  clinicGooglePlaceId?: string;
  reason: string;
  healthConsent: boolean;
  referralConsent: boolean;
  privacyNoticeVersion: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { error: 'Method not allowed.' },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          error: 'Supabase server credentials are missing.',
        },
        500,
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const body =
      (await request.json()) as CreateReferralRequest;

    const patientName = cleanText(body.patientName, 100);
    const patientPhone = cleanText(body.patientPhone, 30);
    const clinicName = cleanText(body.clinicName, 200);
    const clinicGooglePlaceId = cleanText(
      body.clinicGooglePlaceId,
      200,
    );
    const reason = cleanText(body.reason, 200);
    const privacyNoticeVersion = cleanText(
      body.privacyNoticeVersion,
      40,
    );

    if (
      body.healthConsent !== true ||
      body.referralConsent !== true ||
      !privacyNoticeVersion
    ) {
      return jsonResponse(
        { error: 'Required consent is missing.' },
        400,
      );
    }

    if (patientName.length < 2) {
      return jsonResponse(
        { error: 'Patient name is invalid.' },
        400,
      );
    }

    if (!isValidPhone(patientPhone)) {
      return jsonResponse(
        { error: 'Patient phone is invalid.' },
        400,
      );
    }

    if (!clinicName) {
      return jsonResponse(
        { error: 'Clinic name is required.' },
        400,
      );
    }

    if (!reason) {
      return jsonResponse(
        { error: 'Reason is required.' },
        400,
      );
    }

    const now = new Date().toISOString();

    const {
      data: conversation,
      error: conversationError,
    } = await supabaseAdmin
      .from('conversations')
      .insert({
        patient_name: patientName,
        patient_phone: patientPhone,
        status: 'referred',
        referral_clinic: clinicName,
        referral_reason: reason,
        started_at: now,
        ended_at: now,
        health_consent_at: now,
        referral_consent_at: now,
        privacy_notice_version: privacyNoticeVersion,
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .select('id')
      .single();

    if (conversationError || !conversation) {
      console.error(
        'Conversation insert failed:',
        conversationError,
      );

      return jsonResponse(
        { error: 'Could not create conversation.' },
        500,
      );
    }

    const {
      data: referral,
      error: referralError,
    } = await supabaseAdmin
      .from('patient_referrals')
      .insert({
        conversation_id: conversation.id,
        patient_name: patientName,
        clinic_name: clinicName,
        clinic_id: null,
        reason,
        status: 'confirmed',
        referral_consent_at: now,
        privacy_notice_version: privacyNoticeVersion,
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .select('id')
      .single();

    if (referralError || !referral) {
      console.error(
        'Referral insert failed:',
        referralError,
      );

      await supabaseAdmin
        .from('conversations')
        .delete()
        .eq('id', conversation.id);

      return jsonResponse(
        { error: 'Could not create referral.' },
        500,
      );
    }

    return jsonResponse({
      conversationId: conversation.id,
      referralId: referral.id,
      clinicName,
      clinicGooglePlaceId:
        clinicGooglePlaceId || null,
      reason,
    });
  } catch (error) {
    console.error('Create referral error:', error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown server error.',
      },
      500,
    );
  }
});
