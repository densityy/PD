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

interface QueueJob {
    id: string;
    google_place_id: string;
    clinic_name: string;
    source_url: string | null;
    status: string;
}

interface DiscoveryResult {
    discovered?: boolean;
    sourceUrl?: string;
    reason?: string;
    error?: string;
}

interface ImportResult {
    cached?: boolean;
    imported?: boolean;
    importId?: string;
    candidateCount?: number;
    error?: string;
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

        const providedAdminKey =
            request.headers.get(
                'x-admin-key',
            );

        if (providedAdminKey !== adminKey) {
            return jsonResponse(
                {
                    error: 'Unauthorized.',
                },
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

        // Load up to 10 pending jobs.
        // These may or may not already have a source URL.
        const {
            data: jobs,
            error: jobsError,
        } = await supabaseAdmin
            .from(
                'clinic_price_refresh_queue',
            )
            .select(`
        id,
        google_place_id,
        clinic_name,
        source_url,
        status
      `)
            .eq('status', 'pending')
            .order('requested_at', {
                ascending: true,
            })
            .limit(10);

        if (jobsError) {
            console.error(
                'Could not load refresh jobs:',
                jobsError,
            );

            return jsonResponse(
                {
                    error:
                        'Could not load refresh jobs.',
                },
                500,
            );
        }

        if (!jobs || jobs.length === 0) {
            return jsonResponse({
                processedCount: 0,
                completedCount: 0,
                errorCount: 0,
                results: [],
                message:
                    'No pending clinic price refresh jobs.',
            });
        }

        const queueJobs =
            jobs as QueueJob[];

        const results: Array<{
            jobId: string;
            clinicName: string;
            success: boolean;
            sourceDiscovered?: boolean;
            sourceUrl?: string;
            importId?: string;
            candidateCount?: number;
            cached?: boolean;
            error?: string;
        }> = [];

        for (const job of queueJobs) {
            let sourceUrl =
                job.source_url;

            try {
                // Mark job as processing.
                const {
                    error: processingError,
                } = await supabaseAdmin
                    .from(
                        'clinic_price_refresh_queue',
                    )
                    .update({
                        status: 'processing',
                        started_at:
                            new Date().toISOString(),
                        error_message: null,
                    })
                    .eq('id', job.id)
                    .eq('status', 'pending');

                if (processingError) {
                    throw new Error(
                        'Could not mark job as processing.',
                    );
                }

                let sourceDiscovered = false;

                // If we do not know the official price source,
                // discover it automatically.
                if (!sourceUrl) {
                    const discoveryResponse =
                        await fetch(
                            `${supabaseUrl}/functions/v1/discover-clinic-price-source`,
                            {
                                method: 'POST',

                                headers: {
                                    'Content-Type':
                                        'application/json',

                                    'x-admin-key':
                                        adminKey,
                                },

                                body: JSON.stringify({
                                    jobId: job.id,
                                }),
                            },
                        );

                    const discoveryResult =
                        (await discoveryResponse.json()) as DiscoveryResult;

                    if (
                        !discoveryResponse.ok
                    ) {
                        throw new Error(
                            discoveryResult?.error ??
                            'Price source discovery failed.',
                        );
                    }

                    if (
                        !discoveryResult.discovered ||
                        !discoveryResult.sourceUrl
                    ) {
                        throw new Error(
                            discoveryResult.reason ??
                            'No official clinic price source was found.',
                        );
                    }

                    sourceUrl =
                        discoveryResult.sourceUrl;

                    sourceDiscovered = true;
                }

                // We now have an official source URL.
                const importResponse =
                    await fetch(
                        `${supabaseUrl}/functions/v1/import-clinic-prices`,
                        {
                            method: 'POST',

                            headers: {
                                'Content-Type':
                                    'application/json',

                                'x-admin-key':
                                    adminKey,
                            },

                            body: JSON.stringify({
                                googlePlaceId:
                                    job.google_place_id,

                                clinicName:
                                    job.clinic_name,

                                sourceUrl,
                            }),
                        },
                    );

                const importResult =
                    (await importResponse.json()) as ImportResult;

                if (!importResponse.ok) {
                    throw new Error(
                        importResult?.error ??
                        'Clinic price import failed.',
                    );
                }
                if (
                    importResult.imported === true &&
                    (importResult.candidateCount ?? 0) === 0
                ) {
                    throw new Error(
                        'No usable clinic prices were found. Source discovery should be retried.',
                    );
                }

                // Import succeeded.
                const {
                    error: completedError,
                } = await supabaseAdmin
                    .from(
                        'clinic_price_refresh_queue',
                    )
                    .update({
                        status: 'completed',
                        source_url: sourceUrl,
                        completed_at:
                            new Date().toISOString(),
                        error_message: null,
                    })
                    .eq('id', job.id);

                if (completedError) {
                    throw new Error(
                        'Import succeeded but queue status could not be updated.',
                    );
                }

                results.push({
                    jobId: job.id,

                    clinicName:
                        job.clinic_name,

                    success: true,

                    sourceDiscovered,

                    sourceUrl,

                    importId:
                        importResult.importId,

                    candidateCount:
                        importResult.candidateCount,

                    cached:
                        importResult.cached ?? false,
                });
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Unknown processing error.';

                console.error(
                    `Clinic price refresh failed for ${job.clinic_name}:`,
                    error,
                );

                await supabaseAdmin
                    .from(
                        'clinic_price_refresh_queue',
                    )
                    .update({
                        status: 'error',
                        source_url:
                            sourceUrl ?? null,
                        completed_at:
                            new Date().toISOString(),
                        error_message:
                            message,
                    })
                    .eq('id', job.id);

                results.push({
                    jobId: job.id,

                    clinicName:
                        job.clinic_name,

                    success: false,

                    sourceUrl:
                        sourceUrl ?? undefined,

                    error: message,
                });
            }
        }

        const completedCount =
            results.filter(
                (result) =>
                    result.success,
            ).length;

        const errorCount =
            results.length -
            completedCount;

        return jsonResponse({
            processedCount:
                results.length,

            completedCount,

            errorCount,

            results,
        });
    } catch (error) {
        console.error(
            'Process clinic price refresh queue error:',
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