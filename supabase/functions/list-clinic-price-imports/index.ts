import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, x-admin-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    if (
        request.method !== 'GET' &&
        request.method !== 'POST'
    ) {
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

        const {
            data,
            error,
        } = await supabaseAdmin
            .from('clinic_price_imports')
            .select(`
        id,
        google_place_id,
        clinic_name,
        source_url,
        candidates,
        status,
        created_at,
        reviewed_at
      `)
            .eq('status', 'pending')
            .order('created_at', {
                ascending: false,
            });

        if (error) {
            console.error(
                'Could not load price imports:',
                error,
            );

            return jsonResponse(
                {
                    error:
                        'Could not load price imports.',
                },
                500,
            );
        }

        return jsonResponse({
            imports: data ?? [],
        });
    } catch (error) {
        console.error(
            'List clinic price imports error:',
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