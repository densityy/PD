import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface ImportRequest {
    googlePlaceId: string;
    clinicName: string;
    sourceUrl: string;
}

interface ExtractedCandidate {
    treatmentCode:
    | 'examination'
    | 'emergency_consultation'
    | 'root_canal'
    | 'crown'
    | 'teeth_whitening'
    | 'filling'
    | 'dental_cleaning'
    | 'tooth_extraction'
    | 'wisdom_tooth'
    | 'implant';

    treatmentName: string;
    priceFrom: number | null;
    priceTo: number | null;
    sourceText: string;
}

interface ExtractionResult {
    candidates: ExtractedCandidate[];
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

function extractOutputText(responseBody: {
    output_text?: string;
    output?: Array<{
        content?: Array<{
            type?: string;
            text?: string;
        }>;
    }>;
}) {
    if (responseBody.output_text) {
        return responseBody.output_text;
    }

    return responseBody.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === 'output_text')
        ?.text;
}

function cleanHtml(html: string) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
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
        const openAiApiKey =
            Deno.env.get('OPENAI_API_KEY');

        const supabaseUrl =
            Deno.env.get('SUPABASE_URL');

        const serviceRoleKey =
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        const adminKey =
            Deno.env.get('PRICE_IMPORT_ADMIN_KEY');

        if (
            !openAiApiKey ||
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

        const body =
            (await request.json()) as ImportRequest;

        const googlePlaceId =
            body.googlePlaceId?.trim();

        const clinicName =
            body.clinicName?.trim();

        const sourceUrl =
            body.sourceUrl?.trim();

        if (
            !googlePlaceId ||
            !clinicName ||
            !sourceUrl
        ) {
            return jsonResponse(
                {
                    error:
                        'googlePlaceId, clinicName and sourceUrl are required.',
                },
                400,
            );
        }

        let parsedUrl: URL;

        try {
            parsedUrl = new URL(sourceUrl);
        } catch {
            return jsonResponse(
                {
                    error: 'Invalid source URL.',
                },
                400,
            );
        }

        if (
            parsedUrl.protocol !== 'https:' &&
            parsedUrl.protocol !== 'http:'
        ) {
            return jsonResponse(
                {
                    error:
                        'Only HTTP and HTTPS URLs are allowed.',
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

        // Check whether we already have fresh prices.
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
                cached: true,
                googlePlaceId,
                clinicName,
                message:
                    'Fresh clinic prices already exist. Import skipped.',
            });
        }

        // Fetch official clinic price page.
        const pageResponse = await fetch(sourceUrl, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (compatible; PocketDentistPriceImporter/1.0)',
                Accept:
                    'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
        });

        if (!pageResponse.ok) {
            return jsonResponse(
                {
                    error:
                        'Could not load clinic price page.',
                    status: pageResponse.status,
                },
                502,
            );
        }

        const contentType =
            pageResponse.headers.get('content-type') ?? '';

        if (!contentType.includes('text/html')) {
            return jsonResponse(
                {
                    error:
                        'Price source did not return an HTML page.',
                },
                422,
            );
        }

        const html = await pageResponse.text();

        const pageText = cleanHtml(html)
            .slice(0, 40000);

        if (!pageText) {
            return jsonResponse(
                {
                    error:
                        'No readable content found on price page.',
                },
                422,
            );
        }

        // Use OpenAI only after cache miss + successful page fetch.
        const extractionResponse = await fetch(
            'https://api.openai.com/v1/responses',
            {
                method: 'POST',
                headers: {
                    Authorization:
                        `Bearer ${openAiApiKey}`,
                    'Content-Type':
                        'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-5-mini',

                    instructions: `
You extract dental prices from the official price-list text of a Norwegian dental clinic.

Rules:
- Only use information explicitly present in the provided page text.
- Never invent, estimate, infer, or guess a price.
- Ignore prices that cannot confidently be mapped to an allowed treatment.
- All monetary values are NOK unless the page clearly states otherwise.

Normalization:
- Return at most ONE candidate per treatmentCode.
- If multiple valid variants exist for the same treatment, combine them:
  - priceFrom = lowest valid standalone price
  - priceTo = highest valid standalone price
- Example: root canal 1 canal 3305, 2 canals 4630, 3-4 canals 5950
  becomes root_canal with priceFrom 3305 and priceTo 5950.

Important exclusions:
- Do NOT merge implant crowns into normal crowns.
- "Implantatkrone" belongs with implant treatment context, not ordinary crown pricing.
- Do NOT use bundled package prices as standalone treatment prices unless the page clearly provides the standalone treatment price too.
- Example: "undersøkelse + rens" must not become a standalone dental_cleaning price.
- Do NOT combine premium packages with ordinary examination prices.
- Do NOT combine whitening packages with standalone whitening unless the package is explicitly the only published whitening price.
- Temporary fillings must not lower the normal filling range.
- Specialist prices may be included in a range only when they clearly describe the same treatment category.

For ranges:
- priceFrom = lowest clearly supported standalone price.
- priceTo = highest clearly supported standalone price.

For "fra" / "from" prices:
- set priceFrom to that value.
- set priceTo to null unless another clearly comparable standalone price establishes a range.

For one exact price:
- set priceFrom and priceTo to the same value.

sourceText:
- Include a very short excerpt supporting the final normalized price.
- Maximum 160 characters.

Allowed treatment codes:
- examination
- emergency_consultation
- root_canal
- crown
- teeth_whitening
- filling
- dental_cleaning
- tooth_extraction
- wisdom_tooth
- implant
`.trim(),

                    input: pageText,

                    text: {
                        format: {
                            type: 'json_schema',
                            name: 'clinic_price_import',
                            strict: true,

                            schema: {
                                type: 'object',
                                additionalProperties: false,

                                properties: {
                                    candidates: {
                                        type: 'array',

                                        items: {
                                            type: 'object',
                                            additionalProperties: false,

                                            properties: {
                                                treatmentCode: {
                                                    type: 'string',
                                                    enum: [
                                                        'examination',
                                                        'emergency_consultation',
                                                        'root_canal',
                                                        'crown',
                                                        'teeth_whitening',
                                                        'filling',
                                                        'dental_cleaning',
                                                        'tooth_extraction',
                                                        'wisdom_tooth',
                                                        'implant',
                                                    ],
                                                },

                                                treatmentName: {
                                                    type: 'string',
                                                },

                                                priceFrom: {
                                                    type: [
                                                        'integer',
                                                        'null',
                                                    ],
                                                },

                                                priceTo: {
                                                    type: [
                                                        'integer',
                                                        'null',
                                                    ],
                                                },

                                                sourceText: {
                                                    type: 'string',
                                                },
                                            },

                                            required: [
                                                'treatmentCode',
                                                'treatmentName',
                                                'priceFrom',
                                                'priceTo',
                                                'sourceText',
                                            ],
                                        },
                                    },
                                },

                                required: [
                                    'candidates',
                                ],
                            },
                        },
                    },

                    reasoning: {
                        effort: 'low',
                    },

                    max_output_tokens: 3000,
                }),
            },
        );

        const extractionBody =
            await extractionResponse.json();

        if (!extractionResponse.ok) {
            console.error(
                'OpenAI price extraction failed:',
                extractionBody,
            );

            return jsonResponse(
                {
                    error:
                        'Could not extract clinic prices.',
                },
                502,
            );
        }

        const outputText =
            extractOutputText(extractionBody);

        if (!outputText) {
            return jsonResponse(
                {
                    error:
                        'Price extraction returned no output.',
                },
                502,
            );
        }

        let extracted: ExtractionResult;

        try {
            extracted =
                JSON.parse(outputText) as ExtractionResult;
        } catch (error) {
            console.error(
                'Could not parse extracted prices:',
                {
                    outputText,
                    responseStatus:
                        extractionBody.status ?? null,
                    incompleteDetails:
                        extractionBody.incomplete_details ?? null,
                    error,
                },
            );

            return jsonResponse(
                {
                    error:
                        'Price extraction returned invalid data.',
                    reason:
                        extractionBody.incomplete_details ??
                        'Could not parse structured output.',
                },
                502,
            );
        }

        const candidates =
            Array.isArray(extracted.candidates)
                ? extracted.candidates
                : [];

        // Save candidates for review.
        const {
            data: importRow,
            error: importError,
        } = await supabaseAdmin
            .from('clinic_price_imports')
            .insert({
                google_place_id: googlePlaceId,
                clinic_name: clinicName,
                source_url: sourceUrl,
                candidates,
                status: 'pending',
            })
            .select()
            .single();

        if (importError) {
            console.error(
                'Could not save price import:',
                importError,
            );

            return jsonResponse(
                {
                    error:
                        'Could not save imported prices.',
                },
                500,
            );
        }

        return jsonResponse({
            cached: false,
            imported: true,
            importId: importRow.id,
            clinicName,
            googlePlaceId,
            sourceUrl,
            candidateCount: candidates.length,
            candidates,
            status: 'pending',
        });
    } catch (error) {
        console.error(
            'Import clinic prices error:',
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