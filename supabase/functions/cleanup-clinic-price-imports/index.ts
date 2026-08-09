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

interface Candidate {
    treatmentCode?: string;
    priceFrom?: number | null;
    priceTo?: number | null;
}

interface ImportRow {
    id: string;
    google_place_id: string;
    clinic_name: string;
    candidates: Candidate[] | null;
    created_at: string;
}

function getScore(row: ImportRow) {
    const candidates =
        Array.isArray(row.candidates)
            ? row.candidates
            : [];

    const pricedCandidates =
        candidates.filter((candidate) => {
            return (
                typeof candidate.priceFrom === 'number' &&
                Number.isFinite(candidate.priceFrom) &&
                candidate.priceFrom > 0
            );
        }).length;

    /*
     * Priority:
     *
     * 1. Most candidates with actual structured prices
     * 2. Most treatment candidates overall
     * 3. Newest import if otherwise equal
     */
    return {
        pricedCandidates,
        candidateCount: candidates.length,
        timestamp:
            new Date(row.created_at).getTime(),
    };
}

function isBetter(
    candidate: ImportRow,
    current: ImportRow,
) {
    const a = getScore(candidate);
    const b = getScore(current);

    if (
        a.pricedCandidates !==
        b.pricedCandidates
    ) {
        return (
            a.pricedCandidates >
            b.pricedCandidates
        );
    }

    if (
        a.candidateCount !==
        b.candidateCount
    ) {
        return (
            a.candidateCount >
            b.candidateCount
        );
    }

    return a.timestamp > b.timestamp;
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

        if (
            providedAdminKey !== adminKey
        ) {
            return jsonResponse(
                {
                    error: 'Unauthorized.',
                },
                401,
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
         * IMPORTANT:
         * Only pending imports are touched.
         * Approved imports / published prices are never deleted.
         */
        const {
            data,
            error,
        } = await supabaseAdmin
            .from('clinic_price_imports')
            .select(`
                id,
                google_place_id,
                clinic_name,
                candidates,
                created_at
            `)
            .eq('status', 'pending');

        if (error) {
            console.error(error);

            return jsonResponse(
                {
                    error:
                        'Could not load pending imports.',
                },
                500,
            );
        }

        const imports =
            (data ?? []) as ImportRow[];

        const bestByClinic =
            new Map<string, ImportRow>();

        /*
         * Pick the BEST corrected import,
         * not blindly the newest.
         */
        for (const row of imports) {
            if (!row.google_place_id) {
                continue;
            }

            const current =
                bestByClinic.get(
                    row.google_place_id,
                );

            if (
                !current ||
                isBetter(row, current)
            ) {
                bestByClinic.set(
                    row.google_place_id,
                    row,
                );
            }
        }

        const keepIds =
            new Set(
                [...bestByClinic.values()]
                    .map((row) => row.id),
            );

        const deleteRows =
            imports.filter(
                (row) =>
                    !keepIds.has(row.id),
            );

        const deleteIds =
            deleteRows.map(
                (row) => row.id,
            );

        /*
         * Nothing to clean.
         */
        if (deleteIds.length === 0) {
            return jsonResponse({
                cleaned: true,
                pendingBefore:
                    imports.length,
                kept:
                    keepIds.size,
                deleted: 0,
            });
        }

        /*
         * Delete in chunks so we don't create
         * an excessively large query.
         */
        const chunkSize = 100;
        let deleted = 0;

        for (
            let i = 0;
            i < deleteIds.length;
            i += chunkSize
        ) {
            const chunk =
                deleteIds.slice(
                    i,
                    i + chunkSize,
                );

            const {
                error: deleteError,
            } = await supabaseAdmin
                .from(
                    'clinic_price_imports',
                )
                .delete()
                .in('id', chunk)
                .eq('status', 'pending');

            if (deleteError) {
                console.error(
                    'Cleanup failed:',
                    deleteError,
                );

                return jsonResponse(
                    {
                        error:
                            'Could not clean duplicate imports.',
                        deletedBeforeFailure:
                            deleted,
                    },
                    500,
                );
            }

            deleted +=
                chunk.length;
        }

        const keptClinics =
            [...bestByClinic.values()]
                .map((row) => {
                    const score =
                        getScore(row);

                    return {
                        clinicName:
                            row.clinic_name,
                        importId:
                            row.id,
                        pricedCandidates:
                            score.pricedCandidates,
                        candidateCount:
                            score.candidateCount,
                        createdAt:
                            row.created_at,
                    };
                });

        return jsonResponse({
            cleaned: true,
            pendingBefore:
                imports.length,
            clinics:
                bestByClinic.size,
            kept:
                keepIds.size,
            deleted,
            keptImports:
                keptClinics,
        });
    } catch (error) {
        console.error(
            'Cleanup imports error:',
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