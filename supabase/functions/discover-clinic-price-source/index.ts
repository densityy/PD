import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface DiscoverRequest {
    jobId: string;
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

function decodeHtml(value: string) {
    return value
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&nbsp;/gi, ' ');
}

function pageLooksLikePriceList(html: string) {
    const text = decodeHtml(
        html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .toLowerCase(),
    );

    const hasCurrency =
        text.includes(' kr') ||
        text.includes('kr ') ||
        text.includes(',-');

    const dentalWords = [
        'undersøkelse',
        'tannrens',
        'fylling',
        'rotfylling',
        'krone',
        'tannbleking',
        'tannimplantat',
        'implantat',
        'tannrekking',
        'tanntrekking',
    ];

    const treatmentMatches = dentalWords.filter((word) =>
        text.includes(word)
    ).length;

    return hasCurrency && treatmentMatches >= 2;
}

function extractPriceLinks(
    html: string,
    websiteUrl: string,
) {
    const links: string[] = [];

    const linkRegex =
        /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let match: RegExpExecArray | null;

    const baseUrl = new URL(websiteUrl);

    while ((match = linkRegex.exec(html)) !== null) {
        const href = decodeHtml(match[1]);
        const anchorText = decodeHtml(
            match[2].replace(/<[^>]+>/g, ' '),
        ).toLowerCase();

        const searchable =
            `${href} ${anchorText}`.toLowerCase();

        if (
            !searchable.includes('pris') &&
            !searchable.includes('price')
        ) {
            continue;
        }

        try {
            const candidate = new URL(
                href,
                websiteUrl,
            );

            // Only accept links on the clinic's own website.
            if (
                candidate.hostname !==
                baseUrl.hostname
            ) {
                continue;
            }

            links.push(candidate.toString());
        } catch {
            // Ignore malformed links.
        }
    }

    return [...new Set(links)];
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

        const googleMapsApiKey =
            Deno.env.get('GOOGLE_PLACES_API_KEY');

        const adminKey =
            Deno.env.get(
                'PRICE_IMPORT_ADMIN_KEY',
            );

        if (
            !supabaseUrl ||
            !serviceRoleKey ||
            !googleMapsApiKey ||
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

        const body =
            (await request.json()) as DiscoverRequest;

        const jobId =
            body.jobId?.trim();

        if (!jobId) {
            return jsonResponse(
                {
                    error: 'jobId is required.',
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
            data: job,
            error: jobError,
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
            .eq('id', jobId)
            .maybeSingle();

        if (jobError) {
            console.error(
                'Queue lookup failed:',
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
            return jsonResponse(
                {
                    error:
                        'Refresh job was not found.',
                },
                404,
            );
        }

        if (job.source_url) {
            return jsonResponse({
                discovered: true,
                cachedSource: true,
                sourceUrl: job.source_url,
            });
        }

        // Get official website from Google Places.
        const placeResponse = await fetch(
            `https://places.googleapis.com/v1/places/${encodeURIComponent(
                job.google_place_id,
            )}`,
            {
                headers: {
                    'X-Goog-Api-Key':
                        googleMapsApiKey,
                    'X-Goog-FieldMask':
                        'websiteUri',
                },
            },
        );

        const placeBody =
            await placeResponse.json();

        if (!placeResponse.ok) {
            console.error(
                'Google Place Details failed:',
                placeBody,
            );

            return jsonResponse(
                {
                    error:
                        'Could not load clinic website from Google.',
                },
                502,
            );
        }

        const websiteUrl =
            typeof placeBody.websiteUri ===
                'string'
                ? placeBody.websiteUri
                : null;

        if (!websiteUrl) {
            return jsonResponse({
                discovered: false,
                reason:
                    'Clinic has no official website listed by Google.',
            });
        }

        const website = new URL(
            websiteUrl,
        );

        if (
            website.protocol !== 'https:' &&
            website.protocol !== 'http:'
        ) {
            return jsonResponse({
                discovered: false,
                reason:
                    'Clinic website URL is not HTTP/HTTPS.',
            });
        }

        const homeResponse = await fetch(
            websiteUrl,
            {
                redirect: 'follow',
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (compatible; PocketDentistPriceDiscovery/1.0)',
                    Accept:
                        'text/html,application/xhtml+xml',
                },
            },
        );

        if (!homeResponse.ok) {
            return jsonResponse({
                discovered: false,
                websiteUrl,
                reason:
                    'Could not load clinic website.',
            });
        }

        const homepageHtml =
            await homeResponse.text();

        // Homepage itself might be the price page.
        if (
            pageLooksLikePriceList(
                homepageHtml,
            )
        ) {
            await supabaseAdmin
                .from(
                    'clinic_price_refresh_queue',
                )
                .update({
                    source_url: websiteUrl,
                })
                .eq('id', job.id);

            return jsonResponse({
                discovered: true,
                websiteUrl,
                sourceUrl: websiteUrl,
            });
        }

        const discoveredLinks =
            extractPriceLinks(
                homepageHtml,
                websiteUrl,
            );

        // Also try common price-page paths,
        // but only on the verified clinic domain.
        const commonPaths = [
            '/priser/',
            '/priser',
            '/prisliste/',
            '/prisliste',
            '/tannlege-priser/',
            '/tannlege-priser',
        ];

        const candidateUrls = [
            ...discoveredLinks,
            ...commonPaths.map(
                (path) =>
                    new URL(
                        path,
                        websiteUrl,
                    ).toString(),
            ),
        ];

        const uniqueCandidates = [
            ...new Set(candidateUrls),
        ].slice(0, 12);

        let sourceUrl: string | null =
            null;

        for (
            const candidateUrl of
            uniqueCandidates
        ) {
            try {
                const candidate =
                    new URL(candidateUrl);

                // Never leave the clinic's domain.
                if (
                    candidate.hostname !==
                    website.hostname
                ) {
                    continue;
                }

                const response =
                    await fetch(candidateUrl, {
                        redirect: 'follow',
                        headers: {
                            'User-Agent':
                                'Mozilla/5.0 (compatible; PocketDentistPriceDiscovery/1.0)',
                            Accept:
                                'text/html,application/xhtml+xml',
                        },
                    });

                if (!response.ok) {
                    continue;
                }

                const contentType =
                    response.headers.get(
                        'content-type',
                    ) ?? '';

                if (
                    !contentType.includes(
                        'text/html',
                    )
                ) {
                    continue;
                }

                const html =
                    await response.text();

                if (
                    pageLooksLikePriceList(
                        html,
                    )
                ) {
                    sourceUrl =
                        response.url ||
                        candidateUrl;

                    break;
                }
            } catch {
                // Try next candidate.
            }
        }

        if (!sourceUrl) {
            return jsonResponse({
                discovered: false,
                websiteUrl,
                checkedCandidates:
                    uniqueCandidates.length,
                reason:
                    'No verified price page was found.',
            });
        }

        const {
            error: updateError,
        } = await supabaseAdmin
            .from(
                'clinic_price_refresh_queue',
            )
            .update({
                source_url: sourceUrl,
            })
            .eq('id', job.id);

        if (updateError) {
            console.error(
                'Could not save price source:',
                updateError,
            );

            return jsonResponse(
                {
                    error:
                        'Price source was found but could not be saved.',
                },
                500,
            );
        }

        return jsonResponse({
            discovered: true,
            clinicName: job.clinic_name,
            websiteUrl,
            sourceUrl,
        });
    } catch (error) {
        console.error(
            'Price source discovery error:',
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