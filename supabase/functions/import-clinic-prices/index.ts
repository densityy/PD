import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface ImportRequest {
    googlePlaceId: string;
    clinicName: string;
    sourceUrl: string;
    forceRefresh?: boolean;
    treatmentCode?: TreatmentCode | null;
}

type TreatmentCode =
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

interface ExtractedCandidate {
    treatmentCode: TreatmentCode;
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

const MIN_REASONABLE_PRICE: Record<TreatmentCode, number> = {
    examination: 250,
    emergency_consultation: 150,
    root_canal: 1500,
    crown: 2500,
    teeth_whitening: 500,
    filling: 400,
    dental_cleaning: 200,
    tooth_extraction: 500,
    wisdom_tooth: 1000,
    implant: 5000,
};

const MAX_REASONABLE_PRICE: Record<TreatmentCode, number> = {
    examination: 10000,
    emergency_consultation: 10000,
    root_canal: 30000,
    crown: 40000,
    teeth_whitening: 20000,
    filling: 15000,
    dental_cleaning: 10000,
    tooth_extraction: 20000,
    wisdom_tooth: 30000,
    implant: 100000,
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

function extractPdfLinks(
    html: string,
    sourceUrl: string,
) {
    const links: string[] = [];

    const regex =
        /<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>/gi;

    let match: RegExpExecArray | null;

    while (
        (match = regex.exec(html)) !==
        null
    ) {
        try {
            const url =
                new URL(
                    match[1],
                    sourceUrl,
                );

            links.push(
                url.toString(),
            );
        } catch {
            // Ignore malformed PDF links.
        }
    }

    return [
        ...new Set(links),
    ].slice(0, 5);
}

function parsePriceToken(token: string): number | null {
    const cleaned = token
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '')
        .replace(/[^\d]/g, '');

    if (!cleaned) {
        return null;
    }

    const value = Number(cleaned);

    if (!Number.isFinite(value)) {
        return null;
    }

    return Math.round(value);
}

function hasBadPriceContext(
    text: string,
    matchIndex: number,
) {
    const before = text
        .slice(
            Math.max(0, matchIndex - 35),
            matchIndex,
        )
        .toLowerCase();

    const after = text
        .slice(
            matchIndex,
            matchIndex + 35,
        )
        .toLowerCase();

    if (
        /\b(verdi|verdt|spar|besparelse|rabatt)\s*$/i.test(
            before,
        )
    ) {
        return true;
    }

    if (/^\s*(%|prosent)/i.test(after)) {
        return true;
    }

    return false;
}

function collectSupportedPrices(
    candidate: ExtractedCandidate,
): number[] {
    const text =
        candidate.sourceText ?? '';

    if (!text.trim()) {
        return [];
    }

    const min =
        MIN_REASONABLE_PRICE[
        candidate.treatmentCode
        ];

    const max =
        MAX_REASONABLE_PRICE[
        candidate.treatmentCode
        ];

    const values: number[] = [];

    const pricePattern =
        /(?<!\d)(\d{1,2}(?:[ .]\d{3})+|\d{3,6})(?:[.,]-)?(?!\d)/g;

    for (
        const match of text.matchAll(
            pricePattern,
        )
    ) {
        const raw = match[1];

        if (!raw) {
            continue;
        }

        const index =
            match.index ?? 0;

        if (
            hasBadPriceContext(
                text,
                index,
            )
        ) {
            continue;
        }

        const value =
            parsePriceToken(raw);

        if (value === null) {
            continue;
        }

        if (
            value < min ||
            value > max
        ) {
            continue;
        }

        values.push(value);
    }

    return [
        ...new Set(values),
    ].sort((a, b) => a - b);
}

function recoverCandidatePrice(
    candidate: ExtractedCandidate,
): ExtractedCandidate {
    /*
     * If OpenAI already returned a valid
     * structured price, keep it.
     */
    if (
        typeof candidate.priceFrom ===
        'number' &&
        Number.isFinite(
            candidate.priceFrom,
        ) &&
        candidate.priceFrom > 0
    ) {
        return candidate;
    }

    const prices =
        collectSupportedPrices(
            candidate,
        );

    if (prices.length === 0) {
        return {
            ...candidate,
            priceFrom: null,
            priceTo: null,
        };
    }

    const source =
        candidate.sourceText.toLowerCase();

    /*
     * Examination needs protection because
     * price lists often mix examination,
     * follow-up and specialist prices.
     */
    if (
        candidate.treatmentCode ===
        'examination'
    ) {
        const patterns = [
            /(?:^|\s)unders[øo]k(?:else|ing)\s+(?:kr\s*)?(\d{3,5})/i,
            /(?:^|\s)vanlig\s+unders[øo]k(?:else|ing)\s+(?:kr\s*)?(\d{3,5})/i,
            /(?:^|\s)ordin[æa]r\s+unders[øo]k(?:else|ing)\s+(?:kr\s*)?(\d{3,5})/i,
            /(?:^|\s)komplett\s+unders[øo]k(?:else|ing).*?(?:kr\s*)?(\d{3,5})/i,
        ];

        for (
            const pattern of patterns
        ) {
            const match =
                candidate.sourceText.match(
                    pattern,
                );

            if (match?.[1]) {
                const value =
                    parsePriceToken(
                        match[1],
                    );

                if (
                    value !== null &&
                    value >=
                    MIN_REASONABLE_PRICE
                        .examination &&
                    value <=
                    MAX_REASONABLE_PRICE
                        .examination
                ) {
                    return {
                        ...candidate,
                        priceFrom: value,
                        priceTo: value,
                    };
                }
            }
        }

        return {
            ...candidate,
            priceFrom: prices[0],
            priceTo: prices[0],
        };
    }

    /*
     * Emergency consultation can have
     * weekday/weekend/holiday variants.
     */
    if (
        candidate.treatmentCode ===
        'emergency_consultation'
    ) {
        const emergencyMatch =
            candidate.sourceText.match(
                /(?:akutt(?:\s*unders[øo]kelse|\s*konsultasjon|\s*time|\s*bes[øo]k)?).*?(?:kr\.?\s*)?(\d{3,5})/i,
            );

        if (
            emergencyMatch?.[1]
        ) {
            const value =
                parsePriceToken(
                    emergencyMatch[1],
                );

            if (
                value !== null &&
                value >=
                MIN_REASONABLE_PRICE
                    .emergency_consultation &&
                value <=
                MAX_REASONABLE_PRICE
                    .emergency_consultation
            ) {
                return {
                    ...candidate,
                    priceFrom: value,
                    priceTo: value,
                };
            }
        }

        return {
            ...candidate,
            priceFrom: prices[0],
            priceTo: prices[0],
        };
    }

    if (prices.length === 1) {
        const value = prices[0];

        const isFromPrice =
            /\b(fra|frå|from|priser fra|pris fra)\b/i.test(
                source,
            );

        return {
            ...candidate,
            priceFrom: value,
            priceTo:
                isFromPrice
                    ? null
                    : value,
        };
    }

    const rangeFriendlyTreatments:
        TreatmentCode[] = [
            'root_canal',
            'crown',
            'teeth_whitening',
            'filling',
            'dental_cleaning',
            'tooth_extraction',
            'wisdom_tooth',
            'implant',
        ];

    if (
        rangeFriendlyTreatments.includes(
            candidate.treatmentCode,
        )
    ) {
        return {
            ...candidate,
            priceFrom: prices[0],
            priceTo:
                prices[
                prices.length - 1
                ],
        };
    }

    return {
        ...candidate,
        priceFrom: prices[0],
        priceTo: prices[0],
    };
}

function normalizeCandidates(
    candidates: ExtractedCandidate[],
) {
    return candidates
        .filter((candidate) => {
            return Boolean(
                candidate &&
                candidate.treatmentCode &&
                candidate.treatmentName &&
                candidate.sourceText,
            );
        })
        .map((candidate) =>
            recoverCandidatePrice(
                candidate,
            ),
        );
}

async function extractPricesFromPdf(
    pdfUrl: string,
    requestedTreatmentCode: TreatmentCode | null,
    openAiApiKey: string,
): Promise<ExtractedCandidate[]> {
    const extractionScope = requestedTreatmentCode
        ? `Only return the requested treatment: ${requestedTreatmentCode}.`
        : `Return every supported treatment explicitly priced in the PDF.
Supported treatment codes: examination, emergency_consultation, root_canal, crown, teeth_whitening, filling, dental_cleaning, tooth_extraction, wisdom_tooth, implant.`;

    const userRequest = requestedTreatmentCode
        ? `Find the published price for ${requestedTreatmentCode}.`
        : 'Extract all supported dental treatment prices published in this PDF.';

    const response =
        await fetch(
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
                    model:
                        'gpt-5-mini',

                    instructions: `
You extract dental treatment prices from an official Norwegian dental price-list PDF.

Rules:
${extractionScope}
- Only use prices explicitly present in the PDF.
- Never estimate or guess.
- Return at most ONE candidate per treatment code.
- If variants exist, priceFrom is the lowest valid standalone price and priceTo is the highest comparable standalone price.
- For a single exact price, priceFrom and priceTo are equal.
- For "fra" prices, use priceFrom and leave priceTo null unless a comparable upper price is explicitly listed.
- Do not mix implant crowns with normal crowns.
- Do not use package prices unless they clearly represent the requested treatment.
- sourceText must be a short excerpt from the PDF supporting the price.
`.trim(),

                    input: [
                        {
                            role:
                                'user',

                            content: [
                                {
                                    type:
                                        'input_file',

                                    file_url:
                                        pdfUrl,
                                },

                                {
                                    type:
                                        'input_text',

                                    text:
                                        userRequest,
                                },
                            ],
                        },
                    ],

                    text: {
                        format: {
                            type:
                                'json_schema',

                            name:
                                'clinic_pdf_price_import',

                            strict:
                                true,

                            schema: {
                                type:
                                    'object',

                                additionalProperties:
                                    false,

                                properties: {
                                    candidates:
                                    {
                                        type:
                                            'array',

                                        maxItems:
                                            requestedTreatmentCode ? 1 : 10,

                                        items:
                                        {
                                            type:
                                                'object',

                                            additionalProperties:
                                                false,

                                            properties:
                                            {
                                                treatmentCode:
                                                {
                                                    type:
                                                        'string',

                                                    enum:
                                                        [
                                                            requestedTreatmentCode,
                                                        ],
                                                },

                                                treatmentName:
                                                {
                                                    type:
                                                        'string',
                                                },

                                                priceFrom:
                                                {
                                                    type:
                                                        [
                                                            'integer',
                                                            'null',
                                                        ],
                                                },

                                                priceTo:
                                                {
                                                    type:
                                                        [
                                                            'integer',
                                                            'null',
                                                        ],
                                                },

                                                sourceText:
                                                {
                                                    type:
                                                        'string',
                                                },
                                            },

                                            required:
                                                [
                                                    'treatmentCode',
                                                    'treatmentName',
                                                    'priceFrom',
                                                    'priceTo',
                                                    'sourceText',
                                                ],
                                        },
                                    },
                                },

                                required:
                                    [
                                        'candidates',
                                    ],
                            },
                        },
                    },

                    reasoning: {
                        effort:
                            'low',
                    },

                    max_output_tokens:
                        1200,
                }),
            },
        );

    const body =
        await response.json();

    if (!response.ok) {
        console.error(
            'PDF extraction failed:',
            {
                pdfUrl,
                body,
            },
        );

        return [];
    }

    const outputText =
        extractOutputText(body);

    if (!outputText) {
        return [];
    }

    try {
        const parsed =
            JSON.parse(
                outputText,
            ) as ExtractionResult;

        return normalizeCandidates(
            Array.isArray(
                parsed.candidates,
            )
                ? parsed.candidates
                : [],
        ).filter(
            (candidate) =>
                candidate.treatmentCode ===
                requestedTreatmentCode,
        );
    } catch (error) {
        console.error(
            'Could not parse PDF extraction:',
            error,
        );

        return [];
    }
}

Deno.serve(
    async (request: Request) => {
        if (
            request.method ===
            'OPTIONS'
        ) {
            return new Response(
                'ok',
                {
                    headers:
                        corsHeaders,
                },
            );
        }

        if (
            request.method !==
            'POST'
        ) {
            return jsonResponse(
                {
                    error:
                        'Method not allowed.',
                },
                405,
            );
        }

        try {
            const openAiApiKey =
                Deno.env.get(
                    'OPENAI_API_KEY',
                );

            const supabaseUrl =
                Deno.env.get(
                    'SUPABASE_URL',
                );

            const serviceRoleKey =
                Deno.env.get(
                    'SUPABASE_SERVICE_ROLE_KEY',
                );

            const adminKey =
                Deno.env.get(
                    'PRICE_IMPORT_ADMIN_KEY',
                );

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
                request.headers.get(
                    'x-admin-key',
                );

            if (
                providedAdminKey !==
                adminKey
            ) {
                return jsonResponse(
                    {
                        error:
                            'Unauthorized.',
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

            const forceRefresh =
                body.forceRefresh ===
                true;
            const requestedTreatmentCode =
                body.treatmentCode ?? null;

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
                parsedUrl =
                    new URL(
                        sourceUrl,
                    );
            } catch {
                return jsonResponse(
                    {
                        error:
                            'Invalid source URL.',
                    },
                    400,
                );
            }

            if (
                parsedUrl.protocol !==
                'https:' &&
                parsedUrl.protocol !==
                'http:'
            ) {
                return jsonResponse(
                    {
                        error:
                            'Only HTTP and HTTPS URLs are allowed.',
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
                            persistSession:
                                false,
                            autoRefreshToken:
                                false,
                        },
                    },
                );

            /*
             * Normal bulk/background imports
             * may use cache.
             *
             * Patient-triggered refresh passes
             * forceRefresh: true.
             */
            if (!forceRefresh) {
                const {
                    data:
                    pricesAreFresh,
                    error:
                    cacheError,
                } =
                    await supabaseAdmin.rpc(
                        'clinic_prices_are_fresh',
                        {
                            p_google_place_id:
                                googlePlaceId,

                            p_max_age_days:
                                30,
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

                if (
                    pricesAreFresh ===
                    true
                ) {
                    return jsonResponse(
                        {
                            cached:
                                true,

                            googlePlaceId,

                            clinicName,

                            message:
                                'Fresh clinic prices already exist. Import skipped.',
                        },
                    );
                }
            }

            const pageResponse =
                await fetch(
                    sourceUrl,
                    {
                        headers: {
                            'User-Agent':
                                'Mozilla/5.0 (compatible; PocketDentistPriceImporter/1.0)',

                            Accept:
                                'text/html,application/xhtml+xml',
                        },

                        redirect:
                            'follow',
                    },
                );

            if (
                !pageResponse.ok
            ) {
                return jsonResponse(
                    {
                        error:
                            'Could not load clinic price page.',

                        status:
                            pageResponse.status,
                    },
                    502,
                );
            }

            const contentType =
                pageResponse.headers.get(
                    'content-type',
                ) ?? '';

            if (
                !contentType.includes(
                    'text/html',
                )
            ) {
                return jsonResponse(
                    {
                        error:
                            'Price source did not return an HTML page.',
                    },
                    422,
                );
            }

            const html =
                await pageResponse.text();

            const pageText =
                cleanHtml(html).slice(
                    0,
                    40000,
                );

            if (!pageText) {
                return jsonResponse(
                    {
                        error:
                            'No readable content found on price page.',
                    },
                    422,
                );
            }

            const extractionResponse =
                await fetch(
                    'https://api.openai.com/v1/responses',
                    {
                        method:
                            'POST',

                        headers: {
                            Authorization:
                                `Bearer ${openAiApiKey}`,

                            'Content-Type':
                                'application/json',
                        },

                        body:
                            JSON.stringify(
                                {
                                    model:
                                        'gpt-5-mini',

                                    instructions: `
You extract dental prices from the official price-list text of a Norwegian dental clinic.

Rules:
- Only use information explicitly present in the provided page text.
- Never invent, estimate, infer, or guess a price.
- Ignore prices that cannot confidently be mapped to an allowed treatment.
- All monetary values are NOK unless the page clearly states otherwise.

VERY IMPORTANT:
- When sourceText contains a clearly supported numeric treatment price, priceFrom MUST contain a number.
- Do not return priceFrom as null when the excerpt itself clearly contains the treatment price.
- Use plain integer NOK values without spaces, punctuation or currency symbols.
- Example: "fra kr 1.495" becomes 1495.
- Example: "8 490,-" becomes 8490.

Normalization:
- Return at most ONE candidate per treatmentCode.
- If multiple valid variants exist for the same treatment, combine them.
- priceFrom = lowest valid standalone price.
- priceTo = highest valid standalone price.

Important exclusions:
- Do NOT merge implant crowns into normal crowns.
- "Implantatkrone" belongs with implant treatment context, not ordinary crown pricing.
- Do NOT use bundled package prices as standalone treatment prices unless the page clearly provides the standalone treatment price too.
- "undersøkelse + rens" must not become a standalone dental_cleaning price.
- Do NOT combine premium packages with ordinary examination prices.
- Temporary fillings must not lower the normal filling range.
- Specialist prices may only be included when they clearly describe the same treatment category.
- Marketing comparison values such as "verdi 4400" are NOT treatment prices.

For "fra" / "from":
- priceFrom = published starting price.
- priceTo = null unless another clearly comparable standalone price establishes a range.

For one exact price:
- priceFrom and priceTo must both equal that price.

sourceText:
- Include a short excerpt that directly supports the normalized price.
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

                                    input:
                                        pageText,

                                    text: {
                                        format: {
                                            type:
                                                'json_schema',

                                            name:
                                                'clinic_price_import',

                                            strict:
                                                true,

                                            schema: {
                                                type:
                                                    'object',

                                                additionalProperties:
                                                    false,

                                                properties:
                                                {
                                                    candidates:
                                                    {
                                                        type:
                                                            'array',

                                                        items:
                                                        {
                                                            type:
                                                                'object',

                                                            additionalProperties:
                                                                false,

                                                            properties:
                                                            {
                                                                treatmentCode:
                                                                {
                                                                    type:
                                                                        'string',

                                                                    enum:
                                                                        [
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

                                                                treatmentName:
                                                                {
                                                                    type:
                                                                        'string',
                                                                },

                                                                priceFrom:
                                                                {
                                                                    type:
                                                                        [
                                                                            'integer',
                                                                            'null',
                                                                        ],
                                                                },

                                                                priceTo:
                                                                {
                                                                    type:
                                                                        [
                                                                            'integer',
                                                                            'null',
                                                                        ],
                                                                },

                                                                sourceText:
                                                                {
                                                                    type:
                                                                        'string',
                                                                },
                                                            },

                                                            required:
                                                                [
                                                                    'treatmentCode',
                                                                    'treatmentName',
                                                                    'priceFrom',
                                                                    'priceTo',
                                                                    'sourceText',
                                                                ],
                                                        },
                                                    },
                                                },

                                                required:
                                                    [
                                                        'candidates',
                                                    ],
                                            },
                                        },
                                    },

                                    reasoning:
                                    {
                                        effort:
                                            'low',
                                    },

                                    max_output_tokens:
                                        3000,
                                },
                            ),
                    },
                );

            const extractionBody =
                await extractionResponse.json();

            if (
                !extractionResponse.ok
            ) {
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
                extractOutputText(
                    extractionBody,
                );

            if (!outputText) {
                return jsonResponse(
                    {
                        error:
                            'Price extraction returned no output.',
                    },
                    502,
                );
            }

            let extracted:
                ExtractionResult;

            try {
                extracted =
                    JSON.parse(
                        outputText,
                    ) as ExtractionResult;
            } catch (error) {
                console.error(
                    'Could not parse extracted prices:',
                    {
                        outputText,

                        responseStatus:
                            extractionBody.status ??
                            null,

                        incompleteDetails:
                            extractionBody.incomplete_details ??
                            null,

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

            const rawCandidates =
                Array.isArray(
                    extracted.candidates,
                )
                    ? extracted.candidates
                    : [];

            const normalizedCandidates =
                normalizeCandidates(
                    rawCandidates,
                );

            let candidates =
                requestedTreatmentCode
                    ? normalizedCandidates.filter(
                        (candidate) =>
                            candidate.treatmentCode ===
                            requestedTreatmentCode,
                    )
                    : normalizedCandidates;

            /*
             * OFFICIAL PDF ENRICHMENT
             *
             * A linked clinic PDF is usually the most complete source.
             * Read it once and merge every supported treatment into the
             * HTML result. For a treatment-specific request, retain the
             * existing single-treatment behavior.
             */
            let pdfSourceUrl: string | null = null;

            const pdfLinks =
                extractPdfLinks(
                    html,
                    sourceUrl,
                );

            if (pdfLinks.length > 0) {
                console.log(
                    'Official PDF price lists found.',
                    {
                        clinicName,
                        requestedTreatmentCode,
                        pdfLinks,
                    },
                );

                for (const pdfUrl of pdfLinks) {
                    console.log(
                        'Trying official PDF price list:',
                        pdfUrl,
                    );

                    const pdfCandidates =
                        await extractPricesFromPdf(
                            pdfUrl,
                            requestedTreatmentCode,
                            openAiApiKey,
                        );

                    if (pdfCandidates.length > 0) {
                        const mergedCandidates =
                            new Map<TreatmentCode, ExtractedCandidate>();

                        for (const candidate of candidates) {
                            mergedCandidates.set(
                                candidate.treatmentCode,
                                candidate,
                            );
                        }

                        for (const candidate of pdfCandidates) {
                            mergedCandidates.set(
                                candidate.treatmentCode,
                                candidate,
                            );
                        }

                        candidates =
                            [...mergedCandidates.values()];
                        pdfSourceUrl = pdfUrl;

                        console.log(
                            'Prices extracted from PDF:',
                            {
                                clinicName,
                                requestedTreatmentCode,
                                pdfUrl,
                                candidates,
                            },
                        );

                        break;
                    }
                }
            }

            /*
             * Still no trustworthy price after checking
             * both the HTML page and linked official PDFs.
             */
            if (
                requestedTreatmentCode &&
                candidates.length === 0
            ) {
                return jsonResponse({
                    cached: false,
                    imported: false,
                    googlePlaceId,
                    clinicName,
                    sourceUrl,
                    treatmentCode:
                        requestedTreatmentCode,
                    candidateCount: 0,
                    candidates: [],
                    reason:
                        'Requested treatment price was not found in the official price page or linked price-list PDFs.',
                });
            }

            const {
                data: importRow,
                error: importError,
            } = await supabaseAdmin
                .from(
                    'clinic_price_imports',
                )
                .insert({
                    google_place_id:
                        googlePlaceId,

                    clinic_name:
                        clinicName,

                    source_url:
                        pdfSourceUrl ??
                        sourceUrl,

                    candidates,

                    status:
                        'pending',
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

                importId:
                    importRow.id,

                clinicName,

                googlePlaceId,

                sourceUrl,

                candidateCount:
                    candidates.length,

                candidates,

                status:
                    'pending',
            });
        } catch (error) {
            console.error(
                'Import clinic prices error:',
                error,
            );

            return jsonResponse(
                {
                    error:
                        error instanceof
                            Error
                            ? error.message
                            : 'Unknown server error.',
                },
                500,
            );
        }
    },
);
