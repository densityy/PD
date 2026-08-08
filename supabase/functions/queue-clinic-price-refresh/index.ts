import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface QueueRequest {
    googlePlaceId: string;
    clinicName: string;
    clinicCity?: string | null;
    sourceUrl?: string | null;
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
        const supabaseUrl =
            Deno.env.get('SUPABASE_URL');

        const serviceRoleKey =
            Deno.env.get(
                'SUPABASE_SERVICE_ROLE_KEY',
            );

        if (!supabaseUrl || !serviceRoleKey) {
            return jsonResponse(
                {
                    error:
                        'Server credentials are not configured.',
                },
                500,
            );
        }

        const body =
            (await request.json()) as QueueRequest;

        const googlePlaceId =
            body.googlePlaceId?.trim();

        const clinicName =
            body.clinicName?.trim();

        const clinicCity =
            typeof body.clinicCity === 'string'
                ? body.clinicCity.trim() || null
                : null;

        const sourceUrl =
            typeof body.sourceUrl === 'string'
                ? body.sourceUrl.trim() || null
                : null;

        if (!googlePlaceId || !clinicName) {
            return jsonResponse(
                {
                    error:
                        'googlePlaceId and clinicName are required.',
                },
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

        // Check whether the clinic already has fresh prices.
        const {
            data: pricesAreFresh,
            error: cacheError,
        } = await supabaseAdmin.rpc(
            'clinic_prices_are_fresh',
            {
                p_google_place_id: googlePlaceId,
                p_max_age_days: 30,
            },
        );

        if (cacheError) {
            console.error(
                'Price cache check failed:',
                cacheError,
            );

            return jsonResponse(
                {
                    error:
                        'Could not check cached prices.',
                },
                500,
            );
        }

        if (pricesAreFresh === true) {
            return jsonResponse({
                queued: false,
                cached: true,
                message:
                    'Fresh prices already exist.',
            });
        }

        // Avoid duplicate active refresh jobs.
        const {
            data: existingJob,
            error: existingError,
        } = await supabaseAdmin
            .from('clinic_price_refresh_queue')
            .select('id, status, clinic_city')
            .eq(
                'google_place_id',
                googlePlaceId,
            )
            .in('status', [
                'pending',
                'processing',
            ])
            .maybeSingle();

        if (existingError) {
            console.error(
                'Could not check refresh queue:',
                existingError,
            );

            return jsonResponse(
                {
                    error:
                        'Could not check refresh queue.',
                },
                500,
            );
        }

        if (existingJob) {
            // If an old queued row exists without city,
            // fill it in now.
            if (
                clinicCity &&
                !existingJob.clinic_city
            ) {
                await supabaseAdmin
                    .from(
                        'clinic_price_refresh_queue',
                    )
                    .update({
                        clinic_city: clinicCity,
                    })
                    .eq('id', existingJob.id);
            }

            return jsonResponse({
                queued: false,
                cached: false,
                alreadyQueued: true,
                jobId: existingJob.id,
            });
        }

        const {
            data: job,
            error: insertError,
        } = await supabaseAdmin
            .from('clinic_price_refresh_queue')
            .insert({
                google_place_id:
                    googlePlaceId,

                clinic_name:
                    clinicName,

                clinic_city:
                    clinicCity,

                source_url:
                    sourceUrl,

                status:
                    'pending',
            })
            .select()
            .single();

        if (insertError) {
            console.error(
                'Could not queue price refresh:',
                insertError,
            );

            return jsonResponse(
                {
                    error:
                        'Could not queue price refresh.',
                },
                500,
            );
        }

        return jsonResponse({
            queued: true,
            cached: false,
            job,
        });
    } catch (error) {
        console.error(
            'Queue clinic price refresh error:',
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