import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface PriceRequest {
  googlePlaceIds: string[];
  treatmentCode: string;
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
        { error: 'Supabase credentials are missing.' },
        500,
      );
    }

    const body = (await request.json()) as PriceRequest;

    const googlePlaceIds = Array.isArray(body.googlePlaceIds)
      ? body.googlePlaceIds
          .filter(
            (id): id is string =>
              typeof id === 'string',
          )
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 20)
      : [];

    const treatmentCode =
      typeof body.treatmentCode === 'string'
        ? body.treatmentCode.trim()
        : '';

    if (googlePlaceIds.length === 0) {
      return jsonResponse(
        { error: 'At least one clinic ID is required.' },
        400,
      );
    }

    if (!treatmentCode) {
      return jsonResponse(
        { error: 'Treatment code is required.' },
        400,
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

    const {
      data: treatment,
      error: treatmentError,
    } = await supabaseAdmin
      .from('treatments')
      .select('id, code, name')
      .eq('code', treatmentCode)
      .maybeSingle();

    if (treatmentError) {
      console.error(
        'Treatment lookup failed:',
        treatmentError,
      );

      return jsonResponse(
        { error: 'Could not find treatment.' },
        500,
      );
    }

    if (!treatment) {
      return jsonResponse({
        treatment: null,
        prices: [],
      });
    }

    const {
      data: prices,
      error: pricesError,
    } = await supabaseAdmin
      .from('clinic_prices')
      .select(`
        google_place_id,
        clinic_name,
        price_from,
        price_to,
        currency,
        source_type,
        source_url,
        verified_at
      `)
      .eq('treatment_id', treatment.id)
      .in('google_place_id', googlePlaceIds);

    if (pricesError) {
      console.error(
        'Price lookup failed:',
        pricesError,
      );

      return jsonResponse(
        { error: 'Could not load clinic prices.' },
        500,
      );
    }

    return jsonResponse({
      treatment: {
        code: treatment.code,
        name: treatment.name,
      },
      prices: prices ?? [],
    });
  } catch (error) {
    console.error(
      'Price function error:',
      error,
    );

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