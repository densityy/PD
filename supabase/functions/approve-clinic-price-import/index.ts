import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface ApprovalRequest {
    importId: string;
    candidates?: Array<{
        treatmentCode: string;
        priceFrom: number | null;
        priceTo: number | null;
    }>;
}

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

        const body =
            (await request.json()) as ApprovalRequest;

        const importId =
            body.importId?.trim();

        if (!importId) {
            return jsonResponse(
                {
                    error: 'importId is required.',
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

        const {
            data: importRow,
            error: importError,
        } = await supabaseAdmin
            .from('clinic_price_imports')
            .select(`
        id,
        google_place_id,
        clinic_name,
        source_url,
        candidates,
        status
      `)
            .eq('id', importId)
            .maybeSingle();

        if (importError) {
            console.error(
                'Import lookup failed:',
                importError,
            );

            return jsonResponse(
                {
                    error:
                        'Could not load price import.',
                },
                500,
            );
        }

        if (!importRow) {
            return jsonResponse(
                {
                    error:
                        'Price import was not found.',
                },
                404,
            );
        }

        if (importRow.status !== 'pending') {
            return jsonResponse(
                {
                    error:
                        'Only pending imports can be approved.',
                },
                409,
            );
        }

        const sourceCandidates =
            Array.isArray(body.candidates) &&
                body.candidates.length > 0
                ? body.candidates
                : Array.isArray(importRow.candidates)
                    ? importRow.candidates
                    : [];

        if (sourceCandidates.length === 0) {
            return jsonResponse(
                {
                    error:
                        'No candidates were provided.',
                },
                400,
            );
        }

        const treatmentCodes =
            sourceCandidates
                .map((candidate) =>
                    candidate.treatmentCode?.trim(),
                )
                .filter(Boolean);

        const {
            data: treatments,
            error: treatmentsError,
        } = await supabaseAdmin
            .from('treatments')
            .select('id, code, name')
            .in('code', treatmentCodes);

        if (treatmentsError) {
            console.error(
                'Treatment lookup failed:',
                treatmentsError,
            );

            return jsonResponse(
                {
                    error:
                        'Could not load treatments.',
                },
                500,
            );
        }

        const treatmentByCode = new Map(
            (treatments ?? []).map((treatment) => [
                treatment.code,
                treatment,
            ]),
        );

        const rows = [];

        for (const candidate of sourceCandidates) {
            const treatment =
                treatmentByCode.get(
                    candidate.treatmentCode,
                );

            if (!treatment) {
                continue;
            }

            if (
                candidate.priceFrom === null &&
                candidate.priceTo === null
            ) {
                continue;
            }

            rows.push({
                google_place_id:
                    importRow.google_place_id,

                clinic_name:
                    importRow.clinic_name,

                treatment_id:
                    treatment.id,

                price_from:
                    candidate.priceFrom,

                price_to:
                    candidate.priceTo,

                currency: 'NOK',

                source_type:
                    'clinic_website',

                source_url:
                    importRow.source_url,

                verified_at:
                    new Date().toISOString(),
            });
        }

        if (rows.length === 0) {
            return jsonResponse(
                {
                    error:
                        'No valid price rows could be created.',
                },
                400,
            );
        }

        const {
            error: upsertError,
        } = await supabaseAdmin
            .from('clinic_prices')
            .upsert(
                rows,
                {
                    onConflict:
                        'google_place_id,treatment_id',
                },
            );

        if (upsertError) {
            console.error(
                'Price approval failed:',
                upsertError,
            );

            return jsonResponse(
                {
                    error:
                        'Could not publish clinic prices.',
                },
                500,
            );
        }

        const {
            error: statusError,
        } = await supabaseAdmin
            .from('clinic_price_imports')
            .update({
                status: 'approved',
                reviewed_at:
                    new Date().toISOString(),
            })
            .eq('id', importId);

        if (statusError) {
            console.error(
                'Could not update import status:',
                statusError,
            );

            return jsonResponse(
                {
                    error:
                        'Prices were published, but import status could not be updated.',
                },
                500,
            );
        }

        return jsonResponse({
            approved: true,
            importId,
            clinicName:
                importRow.clinic_name,
            publishedCount:
                rows.length,
        });
    } catch (error) {
        console.error(
            'Approve price import error:',
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