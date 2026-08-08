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

function stripTrackingParams(url: string) {
    try {
        const parsed = new URL(url);

        const blockedPrefixes = [
            'utm_',
            'gclid',
            'fbclid',
            'od',
        ];

        for (const key of [...parsed.searchParams.keys()]) {
            const lower = key.toLowerCase();

            if (
                blockedPrefixes.some((prefix) =>
                    lower.startsWith(prefix),
                )
            ) {
                parsed.searchParams.delete(key);
            }
        }

        return parsed.toString();
    } catch {
        return url;
    }
}

function cleanPageText(html: string) {
    return decodeHtml(
        html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
            .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
    );
}

function normalizeText(value: string) {
    return value
        .toLowerCase()
        .replace(/æ/g, 'ae')
        .replace(/ø/g, 'o')
        .replace(/å/g, 'a')
        .replace(/[^a-z0-9\s/_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function pricePageScore(
    html: string,
    url: string,
    clinicCity?: string | null,
) {
    const rawText = cleanPageText(html);

    const text =
        normalizeText(rawText);

    const lowerUrl =
        normalizeText(url);

    let score = 0;

    const strongUrlTerms = [
        '/priser',
        '/prisliste',
        '/price',
        '/prices',
        'behandlinger-og-priser',
        'priser-og-betaling',
        'priser-og-refusjon',
    ];

    for (const term of strongUrlTerms) {
        if (
            lowerUrl.includes(
                normalizeText(term),
            )
        ) {
            score += 8;
        }
    }

    const headingTerms = [
        'prisliste',
        'vare priser',
        'priser',
        'behandlingspriser',
        'tannlegepriser',
    ];

    for (const term of headingTerms) {
        if (text.includes(term)) {
            score += 3;
        }
    }

    const dentalTerms = [
        'undersokelse',
        'akutt',
        'fylling',
        'rotfylling',
        'krone',
        'implantat',
        'tannbleking',
        'tannrens',
        'tanntrekking',
        'visdomstann',
    ];

    const matches =
        dentalTerms.filter((term) =>
            text.includes(term),
        ).length;

    score += matches * 2;

    const currencyPatterns = [
        /\bkr\s?\d/gi,
        /\d[\d\s.]*\s?kr\b/gi,
        /\d[\d\s.]*,-/gi,
    ];

    let priceHits = 0;

    for (const pattern of currencyPatterns) {
        const found =
            rawText.match(pattern);

        priceHits +=
            found?.length ?? 0;
    }

    score += Math.min(
        priceHits,
        12,
    );

    // Prefer a price page that explicitly
    // matches this clinic's city.
    if (clinicCity) {
        const city =
            normalizeText(clinicCity);

        if (
            lowerUrl.includes(city) ||
            text.includes(city)
        ) {
            score += 10;
        }
    }

    return score;
}

function extractInternalLinks(
    html: string,
    websiteUrl: string,
) {
    const baseUrl = new URL(websiteUrl);

    const links: Array<{
        url: string;
        score: number;
    }> = [];

    const linkRegex =
        /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
        const href = decodeHtml(match[1]);

        const anchorText = decodeHtml(
            match[2].replace(/<[^>]+>/g, ' '),
        ).toLowerCase();

        try {
            const candidate = new URL(
                href,
                websiteUrl,
            );

            if (
                candidate.hostname !==
                baseUrl.hostname
            ) {
                continue;
            }

            const searchable =
                `${candidate.pathname} ${anchorText}`.toLowerCase();

            let score = 0;

            if (searchable.includes('prisliste')) {
                score += 20;
            }

            if (searchable.includes('priser')) {
                score += 18;
            }

            if (searchable.includes('pris')) {
                score += 12;
            }

            if (searchable.includes('price')) {
                score += 10;
            }

            if (
                searchable.includes('behandling') &&
                searchable.includes('pris')
            ) {
                score += 12;
            }

            if (
                searchable.includes('refusjon') ||
                searchable.includes('betaling')
            ) {
                score += 5;
            }

            if (score > 0) {
                links.push({
                    url: stripTrackingParams(
                        candidate.toString(),
                    ),
                    score,
                });
            }
        } catch {
            // Ignore malformed links.
        }
    }

    const deduplicated = new Map<
        string,
        number
    >();

    for (const link of links) {
        const old =
            deduplicated.get(link.url) ?? 0;

        if (link.score > old) {
            deduplicated.set(
                link.url,
                link.score,
            );
        }
    }

    return [...deduplicated.entries()]
        .map(([url, score]) => ({
            url,
            score,
        }))
        .sort(
            (a, b) =>
                b.score - a.score,
        );
}

async function fetchHtml(url: string) {
    try {
        const response = await fetch(url, {
            redirect: 'follow',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (compatible; PocketDentistPriceDiscovery/1.0)',
                Accept:
                    'text/html,application/xhtml+xml',
            },
        });

        if (!response.ok) {
            return null;
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
            return null;
        }

        const html =
            await response.text();

        return {
            html,
            finalUrl:
                stripTrackingParams(
                    response.url || url,
                ),
        };
    } catch {
        return null;
    }
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

        const googlePlacesApiKey =
            Deno.env.get(
                'GOOGLE_PLACES_API_KEY',
            );

        const adminKey =
            Deno.env.get(
                'PRICE_IMPORT_ADMIN_KEY',
            );

        if (
            !supabaseUrl ||
            !serviceRoleKey ||
            !googlePlacesApiKey ||
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
                    error:
                        'jobId is required.',
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
  clinic_city,
  source_url,
  status
`)
            .eq('id', jobId)
            .maybeSingle();

        if (jobError) {
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

        const placeResponse =
            await fetch(
                `https://places.googleapis.com/v1/places/${encodeURIComponent(
                    job.google_place_id,
                )}`,
                {
                    headers: {
                        'X-Goog-Api-Key':
                            googlePlacesApiKey,

                        'X-Goog-FieldMask':
                            'websiteUri',
                    },
                },
            );

        const placeBody =
            await placeResponse.json();

        if (!placeResponse.ok) {
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
                ? stripTrackingParams(
                    placeBody.websiteUri,
                )
                : null;

        if (!websiteUrl) {
            return jsonResponse({
                discovered: false,
                reason:
                    'Clinic has no official website listed by Google.',
            });
        }

        const website =
            new URL(websiteUrl);

        const homepage =
            await fetchHtml(
                websiteUrl,
            );

        if (!homepage) {
            return jsonResponse({
                discovered: false,
                websiteUrl,
                reason:
                    'Could not load clinic website.',
            });
        }

        const internalLinks =
            extractInternalLinks(
                homepage.html,
                homepage.finalUrl,
            );

        const commonPaths = [
            '/priser/',
            '/priser',
            '/prisliste/',
            '/prisliste',
            '/behandlinger-og-priser/',
            '/behandlinger-og-priser',
            '/priser-og-betaling/',
            '/priser-og-betaling',
            '/priser-og-refusjon/',
            '/priser-og-refusjon',
            '/tannlege-priser/',
            '/tannlege-priser',
        ];

        const candidateUrls = [
            ...internalLinks.map(
                (item) => item.url,
            ),

            ...commonPaths.map(
                (path) =>
                    new URL(
                        path,
                        homepage.finalUrl,
                    ).toString(),
            ),
        ];

        const uniqueCandidates = [
            ...new Set(
                candidateUrls.map(
                    stripTrackingParams,
                ),
            ),
        ].slice(0, 20);

        let bestUrl: string | null =
            null;

        let bestScore = 0;

        for (
            const candidateUrl of
            uniqueCandidates
        ) {
            try {
                const candidate =
                    new URL(candidateUrl);

                if (
                    candidate.hostname !==
                    website.hostname
                ) {
                    continue;
                }

                const page =
                    await fetchHtml(
                        candidateUrl,
                    );

                if (!page) {
                    continue;
                }

                const score =
                    pricePageScore(
                        page.html,
                        page.finalUrl,
                        job.clinic_city,
                    );

                if (score > bestScore) {
                    bestScore = score;
                    bestUrl =
                        page.finalUrl;
                }

                // Strong enough to stop early.
                if (score >= 20) {
                    break;
                }
            } catch {
                // Try next candidate.
            }
        }

        // Only consider homepage as fallback.
        const homepageScore =
            pricePageScore(
                homepage.html,
                homepage.finalUrl,
                job.clinic_city,
            );

        if (
            !bestUrl &&
            homepageScore >= 18
        ) {
            bestUrl =
                homepage.finalUrl;

            bestScore =
                homepageScore;
        }

        if (!bestUrl) {
            return jsonResponse({
                discovered: false,
                websiteUrl:
                    homepage.finalUrl,

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
                source_url:
                    stripTrackingParams(
                        bestUrl,
                    ),
            })
            .eq('id', job.id);

        if (updateError) {
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

            clinicName:
                job.clinic_name,

            websiteUrl:
                homepage.finalUrl,

            sourceUrl:
                stripTrackingParams(
                    bestUrl,
                ),

            score:
                bestScore,

            checkedCandidates:
                uniqueCandidates.length,
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