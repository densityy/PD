import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminKey = Deno.env.get('PRICE_IMPORT_ADMIN_KEY');

  if (!supabaseUrl || !serviceRoleKey || !adminKey) {
    return json({ error: 'Server credentials are not configured.' }, 500);
  }

  if (request.headers.get('x-admin-key') !== adminKey) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const staleBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: clinics, error } = await admin
    .from('clinic_directory')
    .select('google_place_id,clinic_name,website,price_list_url,country_code,price_refresh_requested_at')
    .eq('country_code', 'NO')
    .or(`price_refresh_requested_at.is.null,price_refresh_requested_at.lt.${staleBefore}`)
    .order('price_refresh_requested_at', { ascending: true, nullsFirst: true })
    .limit(25);

  if (error) return json({ error: error.message }, 500);

  const results = await Promise.allSettled((clinics ?? []).map((clinic) =>
    fetch(`${supabaseUrl}/functions/v1/queue-clinic-price-refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        googlePlaceId: clinic.google_place_id,
        clinicName: clinic.clinic_name,
        sourceUrl: clinic.price_list_url,
        websiteUrl: clinic.website,
        treatmentCode: null,
        countryCode: 'NO',
      }),
    }),
  ));

  const requestedIds = (clinics ?? []).map((clinic) => clinic.google_place_id);
  if (requestedIds.length > 0) {
    await admin
      .from('clinic_directory')
      .update({ price_refresh_requested_at: new Date().toISOString() })
      .in('google_place_id', requestedIds);
  }

  return json({
    countryCode: 'NO',
    considered: clinics?.length ?? 0,
    queued: results.filter((result) => result.status === 'fulfilled').length,
  });
});
