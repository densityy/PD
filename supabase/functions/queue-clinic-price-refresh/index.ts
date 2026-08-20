import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface QueueRequest {
    googlePlaceId: string;
    clinicName: string;
    clinicCity?: string | null;
    sourceUrl?: string | null;
    websiteUrl?: string | null;
    treatmentCode?: string | null;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(
    body: unknown,
    status = 200,
) {
    return new Response(
        JSON.stringify(body),
        {
            status,
            headers: {
                ...corsHeaders,
                'Content-Type':
                    'application/json',
            },
        },
    );
}

function wakePriceProcessor(
    supabaseUrl: string,
    serviceRoleKey: string,
    adminKey: string,
) {
    const task = fetch(
        `${supabaseUrl}/functions/v1/process-clinic-price-refresh-queue`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                apikey: serviceRoleKey,
                'x-admin-key': adminKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source: 'clinic-finder',
            }),
        },
    ).catch((error) => {
        console.error(
            'Could not trigger processor:',
            error,
        );
    });

    /*
     * Supabase Edge Functions may finish the request as soon as a
     * response is returned. Register the wake-up as background work so
     * the runtime keeps it alive long enough to reach the processor.
     */
    EdgeRuntime.waitUntil(task);
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', {
            headers: corsHeaders,
        });
    }

    if (request.method !== 'POST') {
        return jsonResponse(
            {
                error: 'Method not allowed.',
            },
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

        const adminKey =
            Deno.env.get(
                'PRICE_IMPORT_ADMIN_KEY',
            );

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

        const websiteUrl =
            typeof body.websiteUrl === 'string'
                ? body.websiteUrl.trim() || null
                : null;

        const treatmentCode =
            typeof body.treatmentCode === 'string'
                ? body.treatmentCode.trim() || null
                : null;

        if (
            !googlePlaceId ||
            !clinicName
        ) {
            return jsonResponse(
                {
                    error:
                        'googlePlaceId and clinicName are required.',
                },
                400,
            );
        }

        const supabaseAdmin =
            createClient(
                supabaseUrl,
                serviceRoleKey,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                    },
                },
            );

        /*
         * Check the SPECIFIC treatment.
         */
        if (treatmentCode) {
            const {
                data: treatment,
                error: treatmentError,
            } = await supabaseAdmin
                .from('treatments')
                .select('id')
                .eq(
                    'code',
                    treatmentCode,
                )
                .maybeSingle();

            if (treatmentError) {
                return jsonResponse(
                    {
                        error:
                            'Could not look up treatment.',
                    },
                    500,
                );
            }

            if (treatment) {
                const freshSince =
                    new Date(
                        Date.now() -
                        30 *
                        24 *
                        60 *
                        60 *
                        1000,
                    ).toISOString();

                const {
                    data: existingPrice,
                    error: priceError,
                } = await supabaseAdmin
                    .from('clinic_prices')
                    .select('id')
                    .eq(
                        'google_place_id',
                        googlePlaceId,
                    )
                    .eq(
                        'treatment_id',
                        treatment.id,
                    )
                    .gte(
                        'verified_at',
                        freshSince,
                    )
                    .limit(1)
                    .maybeSingle();

                if (priceError) {
                    return jsonResponse(
                        {
                            error:
                                'Could not check treatment price.',
                        },
                        500,
                    );
                }

                if (existingPrice) {
                    return jsonResponse({
                        queued: false,
                        cached: true,
                        treatmentCode,
                    });
                }
            }
        }

        /*
         * Only dedupe the SAME clinic +
         * SAME treatment.
         */
        let existingQuery =
            supabaseAdmin
                .from(
                    'clinic_price_refresh_queue',
                )
                .select(`
    id,
    status,
    clinic_city,
    source_url,
    website_url,
    treatment_code
`)
                .eq(
                    'google_place_id',
                    googlePlaceId,
                )
                .in(
                    'status',
                    [
                        'pending',
                        'processing',
                    ],
                );

        if (treatmentCode) {
            existingQuery =
                existingQuery.eq(
                    'treatment_code',
                    treatmentCode,
                );
        } else {
            existingQuery =
                existingQuery.is(
                    'treatment_code',
                    null,
                );
        }

        const {
            data: existingJobs,
            error: existingError,
        } = await existingQuery
            .limit(1);

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

        const existingJob =
            existingJobs?.[0];

        if (existingJob) {
            const updates:
                Record<string, unknown> = {};

            if (
                clinicCity &&
                !existingJob.clinic_city
            ) {
                updates.clinic_city =
                    clinicCity;
            }

            if (
                sourceUrl &&
                !existingJob.source_url
            ) {
                updates.source_url =
                    sourceUrl;
            }

            if (
                Object.keys(updates)
                    .length > 0
            ) {
                await supabaseAdmin
                    .from(
                        'clinic_price_refresh_queue',
                    )
                    .update(updates)
                    .eq(
                        'id',
                        existingJob.id,
                    );
            }

            /*
             * Wake the processor.
             */
            wakePriceProcessor(
                supabaseUrl,
                serviceRoleKey,
                adminKey,
            );

            return jsonResponse({
                queued: false,
                cached: false,
                alreadyQueued: true,
                jobId:
                    existingJob.id,
                treatmentCode,
            });
        }

        /*
         * Create a treatment-specific job.
         */
        const {
            data: job,
            error: insertError,
        } = await supabaseAdmin
            .from(
                'clinic_price_refresh_queue',
            )
            .insert({
                google_place_id:
                    googlePlaceId,

                clinic_name:
                    clinicName,

                clinic_city:
                    clinicCity,

                source_url:
                    sourceUrl,

                website_url:
                    websiteUrl,

                treatment_code:
                    treatmentCode,

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

        /*
         * Secure server-to-server processor trigger.
         */
        wakePriceProcessor(
            supabaseUrl,
            serviceRoleKey,
            adminKey,
        );

        return jsonResponse({
            queued: true,
            cached: false,
            treatmentCode,
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
