import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, x-admin-key',
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
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        const adminKey =
            Deno.env.get('PRICE_IMPORT_ADMIN_KEY');

        if (
            !supabaseUrl ||
            !serviceRoleKey ||
            !adminKey
        ) {
            return jsonResponse(
                {
                    error:
                        'Server credentials are not configured.',
                },
                500,
            );
        }

        const providedAdminKey =
            request.headers.get('x-admin-key');

        if (providedAdminKey !== adminKey) {
            return jsonResponse(
                { error: 'Unauthorized.' },
                401,
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
            data: job,
            error: jobError,
        } = await supabaseAdmin
            .from('clinic_price_refresh_queue')
            .select(`
        id,
        google_place_id,
        clinic_name,
        source_url,
        status
      `)
            .eq('status', 'pending')
            .not('source_url', 'is', null)
            .order('requested_at', {
                ascending: true,
            })
            .limit(1)
            .maybeSingle();

        if (jobError) {
            console.error(
                'Could not load refresh job:',
                jobError,
            );

            return jsonResponse(
                {
                    error:
                        'Could not load refresh job.',
                },
                500,
            );
        }

        if (!job) {
            return jsonResponse({
                processed: false,
                message:
                    'No pending refresh jobs with a source URL.',
            });
        }

        const {
            error: processingError,
        } = await supabaseAdmin
            .from('clinic_price_refresh_queue')
            .update({
                status: 'processing',
                started_at: new Date().toISOString(),
                error_message: null,
            })
            .eq('id', job.id);

        if (processingError) {
            return jsonResponse(
                {
                    error:
                        'Could not mark refresh job as processing.',
                },
                500,
            );
        }

        const importResponse = await fetch(
            `${supabaseUrl}/functions/v1/import-clinic-prices`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminKey,
                },
                body: JSON.stringify({
                    googlePlaceId: job.google_place_id,
                    clinicName: job.clinic_name,
                    sourceUrl: job.source_url,
                }),
            },
        );

        const importResult =
            await importResponse.json();

        if (!importResponse.ok) {
            console.error(
                'Price import failed:',
                importResult,
            );

            await supabaseAdmin
                .from('clinic_price_refresh_queue')
                .update({
                    status: 'error',
                    completed_at:
                        new Date().toISOString(),
                    error_message:
                        importResult?.error ??
                        'Price import failed.',
                })
                .eq('id', job.id);

            return jsonResponse(
                {
                    processed: false,
                    jobId: job.id,
                    error:
                        importResult?.error ??
                        'Price import failed.',
                },
                502,
            );
        }

        await supabaseAdmin
            .from('clinic_price_refresh_queue')
            .update({
                status: 'completed',
                completed_at:
                    new Date().toISOString(),
                error_message: null,
            })
            .eq('id', job.id);

        return jsonResponse({
            processed: true,
            jobId: job.id,
            clinicName: job.clinic_name,
            importResult,
        });
    } catch (error) {
        console.error(
            'Process clinic price queue error:',
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