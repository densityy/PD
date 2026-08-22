import { createClient } from "npm:@supabase/supabase-js@2";

type ClinicType = "public" | "private" | null;
type Confidence = "high" | "medium" | "unknown";

interface ClassifyClinicRequest {
  googlePlaceId: string;
  clinicName: string;
  website?: string | null;
  address?: string | null;
}

interface ClassificationResult {
  clinicType: ClinicType;
  confidence: Confidence;
  reason: string;
  sourceUrl: string | null;
}

interface NavGuaranteeResult {
  accepted: boolean | null;
  sourceUrl: string | null;
}

interface PageData {
  url: string;
  html: string;
  text: string;
}

const PUBLIC_DOMAIN_PATTERNS = [
  ".fylke.no",
  "fylkeskommune.no",
];

const PUBLIC_TEXT_PATTERNS = [
  /\bden offentlige tannhelsetjenesten\b/i,
  /\boffentlig tannhelsetjeneste\b/i,
  /\boffentlige tannhelsetjenesten\b/i,
  /\bfylkeskommunal tannhelse\b/i,
  /\bfylkeskommunale tannhelsetjenesten\b/i,
  /\bfylkeskommune\b/i,
];

const PRIVATE_TEXT_PATTERNS = [
  /\bprivat tannklinikk\b/i,
  /\bprivat tannlege\b/i,
  /\btannlegekjede\b/i,
  /\bklinikkjede\b/i,
  /\baksjeselskap\b/i,
  /\borganisasjonsnummer\b/i,
  /\borg\.?\s*nr\.?\b/i,
  /\bmajoritetseier\b/i,
  /\beies av\b/i,
  /\beier av\b/i,
  /\bholding\b/i,
];

const PRIVATE_NAME_PATTERNS = [
  /\bAS\b/i,
  /\bASA\b/i,
  /\bDA\b/i,
  /\bANS\b/i,
];

const ABOUT_LINK_PATTERNS = [
  /om oss/i,
  /om klinikken/i,
  /om virksomheten/i,
  /om selskapet/i,
  /about us/i,
  /about/i,
  /eierskap/i,
  /ownership/i,
];

const NAV_GUARANTEE_PATTERNS = [
  /\bnav[-\s]?garanti\b/i,
  /\bbetalingsgaranti\s+fra\s+nav\b/i,
  /\bgaranti\s+fra\s+nav\b/i,
  /\btar\s+imot\s+(?:betalings)?garanti\s+fra\s+nav\b/i,
  /\baksepterer\s+(?:betalings)?garanti\s+fra\s+nav\b/i,
  /\bdirekte\s+oppgj(?:ø|o)r\s+med\s+nav\b/i,
];

function getHostname(
  website?: string | null,
) {
  if (!website) {
    return "";
  }

  try {
    return new URL(website)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function htmlToText(
  html: string,
) {
  return html
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      " ",
    )
    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      " ",
    )
    .replace(
      /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
      " ",
    )
    .replace(
      /<!--[\s\S]*?-->/g,
      " ",
    )
    .replace(
      /<[^>]+>/g,
      " ",
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&aring;/gi, "å")
    .replace(/&aelig;/gi, "æ")
    .replace(/&oslash;/gi, "ø")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(
  url: string,
): Promise<PageData | null> {
  try {
    const response =
      await fetch(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 PocketDentistClinicClassifier/2.0",

            Accept:
              "text/html,application/xhtml+xml",
          },

          redirect: "follow",

          signal:
            AbortSignal.timeout(
              8000,
            ),
        },
      );

    if (!response.ok) {
      console.log(
        "Classification page HTTP error:",
        {
          url,
          status:
            response.status,
        },
      );

      return null;
    }

    const contentType =
      response.headers.get(
        "content-type",
      ) ?? "";

    if (
      !contentType.includes(
        "text/html",
      )
    ) {
      return null;
    }

    const html =
      (
        await response.text()
      ).slice(
        0,
        1_500_000,
      );

    return {
      url:
        response.url ||
        url,

      html,

      text:
        htmlToText(
          html,
        ),
    };
  } catch (error) {
    console.log(
      "Classification page fetch failed:",
      {
        url,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );

    return null;
  }
}

function classifyText(
  text: string,
  sourceUrl: string,
): ClassificationResult {
  const publicMatches =
    PUBLIC_TEXT_PATTERNS.filter(
      (pattern) =>
        pattern.test(text),
    ).length;

  const privateMatches =
    PRIVATE_TEXT_PATTERNS.filter(
      (pattern) =>
        pattern.test(text),
    ).length;

  console.log(
    "Classification signals:",
    {
      sourceUrl,
      publicMatches,
      privateMatches,
    },
  );

  if (
    publicMatches >= 2 &&
    privateMatches === 0
  ) {
    return {
      clinicType:
        "public",

      confidence:
        "high",

      reason:
        "Official website contains multiple public dental-service signals.",

      sourceUrl,
    };
  }

  if (
    publicMatches === 1 &&
    privateMatches === 0
  ) {
    return {
      clinicType:
        "public",

      confidence:
        "medium",

      reason:
        "Official website contains a public dental-service signal.",

      sourceUrl,
    };
  }

  if (
    privateMatches >= 2 &&
    publicMatches === 0
  ) {
    return {
      clinicType:
        "private",

      confidence:
        "high",

      reason:
        "Official website contains multiple private ownership/company signals.",

      sourceUrl,
    };
  }

  if (
    privateMatches === 1 &&
    publicMatches === 0
  ) {
    return {
      clinicType:
        "private",

      confidence:
        "medium",

      reason:
        "Official website contains a private ownership/company signal.",

      sourceUrl,
    };
  }

  return {
    clinicType: null,
    confidence: "unknown",

    reason:
      publicMatches > 0 &&
        privateMatches > 0
        ? "Official website contained conflicting public/private signals."
        : "Official website did not contain enough reliable ownership evidence.",

    sourceUrl,
  };
}

function extractAboutLinks(
  html: string,
  pageUrl: string,
) {
  const originalHostname =
    getHostname(
      pageUrl,
    );

  const candidates:
    {
      url: string;
      score: number;
    }[] = [];

  const anchorRegex =
    /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match:
    RegExpExecArray | null;

  while (
    (
      match =
      anchorRegex.exec(
        html,
      )
    ) !== null
  ) {
    const href =
      match[1];

    const anchorText =
      htmlToText(
        match[2],
      );

    let resolvedUrl:
      URL;

    try {
      resolvedUrl =
        new URL(
          href,
          pageUrl,
        );
    } catch {
      continue;
    }

    if (
      ![
        "http:",
        "https:",
      ].includes(
        resolvedUrl.protocol,
      )
    ) {
      continue;
    }

    const candidateHostname =
      resolvedUrl.hostname
        .replace(
          /^www\./,
          "",
        )
        .toLowerCase();

    if (
      candidateHostname !==
      originalHostname
    ) {
      continue;
    }

    const searchable =
      `${anchorText} ${resolvedUrl.pathname}`;

    let score = 0;

    for (
      const pattern
      of ABOUT_LINK_PATTERNS
    ) {
      if (
        pattern.test(
          searchable,
        )
      ) {
        score += 10;
      }
    }

    if (
      /om-oss|om_oss|about-us|about_us/i
        .test(
          resolvedUrl.pathname,
        )
    ) {
      score += 20;
    }

    if (
      /eier|ownership|selskap|virksomhet/i
        .test(
          resolvedUrl.pathname,
        )
    ) {
      score += 15;
    }

    if (score === 0) {
      continue;
    }

    resolvedUrl.hash = "";

    candidates.push({
      url:
        resolvedUrl.toString(),

      score,
    });
  }

  const unique =
    new Map<
      string,
      number
    >();

  for (
    const candidate
    of candidates
  ) {
    const previous =
      unique.get(
        candidate.url,
      ) ?? 0;

    if (
      candidate.score >
      previous
    ) {
      unique.set(
        candidate.url,
        candidate.score,
      );
    }
  }

  return [
    ...unique.entries(),
  ]
    .map(
      ([url, score]) => ({
        url,
        score,
      }),
    )
    .sort(
      (a, b) =>
        b.score -
        a.score,
    )
    .slice(
      0,
      3,
    )
    .map(
      (candidate) =>
        candidate.url,
    );
}

function classifyKnownSignals(
  clinicName: string,
  website?: string | null,
): ClassificationResult | null {
  const hostname =
    getHostname(
      website,
    );

  if (
    hostname &&
    PUBLIC_DOMAIN_PATTERNS.some(
      (pattern) =>
        hostname.includes(
          pattern,
        ),
    )
  ) {
    return {
      clinicType:
        "public",

      confidence:
        "high",

      reason:
        "Clinic uses an official county/public-sector domain.",

      sourceUrl:
        website ?? null,
    };
  }

  if (
    PRIVATE_NAME_PATTERNS.some(
      (pattern) =>
        pattern.test(
          clinicName,
        ),
    )
  ) {
    return {
      clinicType:
        "private",

      confidence:
        "high",

      reason:
        "Clinic name contains a private-company legal suffix.",

      sourceUrl:
        website ?? null,
    };
  }

  return null;
}

async function classifyClinic(
  clinicName: string,
  website?: string | null,
): Promise<ClassificationResult> {
  const known =
    classifyKnownSignals(
      clinicName,
      website,
    );

  if (known) {
    return known;
  }

  if (!website) {
    return {
      clinicType: null,
      confidence: "unknown",

      reason:
        "No official website was available for classification.",

      sourceUrl: null,
    };
  }

  /*
   * 1. Inspect the actual clinic page.
   */
  const clinicPage =
    await fetchPage(
      website,
    );

  if (!clinicPage) {
    return {
      clinicType: null,
      confidence: "unknown",

      reason:
        "Official clinic website could not be inspected.",

      sourceUrl:
        website,
    };
  }

  const directResult =
    classifyText(
      clinicPage.text,
      clinicPage.url,
    );

  /*
   * High confidence directly on the clinic
   * page is enough.
   */
  if (
    directResult.clinicType &&
    directResult.confidence ===
    "high"
  ) {
    return directResult;
  }

  /*
   * 2. Discover relevant internal pages:
   *    Om oss, About, ownership etc.
   */
  const aboutLinks =
    extractAboutLinks(
      clinicPage.html,
      clinicPage.url,
    );

  console.log(
    "Classification about links:",
    {
      clinicName,
      aboutLinks,
    },
  );

  /*
   * 3. Inspect maximum 3 pages.
   */
  for (
    const aboutUrl
    of aboutLinks
  ) {
    const page =
      await fetchPage(
        aboutUrl,
      );

    if (!page) {
      continue;
    }

    const result =
      classifyText(
        page.text,
        page.url,
      );

    /*
     * An ownership/about page with
     * high-confidence evidence wins.
     */
    if (
      result.clinicType &&
      result.confidence ===
      "high"
    ) {
      return result;
    }

    /*
     * Medium evidence from an explicit
     * About/ownership page is also useful,
     * provided it isn't conflicting.
     */
    if (
      result.clinicType &&
      result.confidence ===
      "medium"
    ) {
      return result;
    }
  }

  /*
   * If the clinic page itself gave a
   * medium-confidence result and none of
   * the ownership pages contradicted it,
   * use that result.
   */
  if (
    directResult.clinicType &&
    directResult.confidence ===
    "medium"
  ) {
    return directResult;
  }

  return {
    clinicType: null,
    confidence: "unknown",

    reason:
      "Clinic page and relevant ownership/about pages did not contain enough reliable evidence.",

    sourceUrl:
      clinicPage.url,
  };
}

function containsNavGuarantee(text: string) {
  return NAV_GUARANTEE_PATTERNS.some((pattern) => pattern.test(text));
}

function extractNavInformationLinks(html: string, pageUrl: string) {
  const hostname = getHostname(pageUrl);
  const links = new Set<string>();
  const anchorRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const searchable = `${htmlToText(match[2])} ${match[1]}`;
    if (!/nav|betaling|finansiering|pris|sosialhjelp|garanti/i.test(searchable)) {
      continue;
    }

    try {
      const url = new URL(match[1], pageUrl);
      if (["http:", "https:"].includes(url.protocol) && getHostname(url.toString()) === hostname) {
        url.hash = "";
        links.add(url.toString());
      }
    } catch {
      // Ignore malformed links from third-party clinic sites.
    }
  }

  return [...links].slice(0, 4);
}

async function detectNavGuarantee(
  website?: string | null,
): Promise<NavGuaranteeResult> {
  if (!website) {
    return { accepted: null, sourceUrl: null };
  }

  const homepage = await fetchPage(website);
  if (!homepage) {
    return { accepted: null, sourceUrl: website };
  }

  if (containsNavGuarantee(homepage.text)) {
    return { accepted: true, sourceUrl: homepage.url };
  }

  for (const url of extractNavInformationLinks(homepage.html, homepage.url)) {
    const page = await fetchPage(url);
    if (page && containsNavGuarantee(page.text)) {
      return { accepted: true, sourceUrl: page.url };
    }
  }

  /* Absence of a statement is unknown, never a verified rejection. */
  return { accepted: null, sourceUrl: homepage.url };
}

Deno.serve(
  async (
    request: Request,
  ) => {
    const headers = {
      "Content-Type":
        "application/json",

      "Access-Control-Allow-Origin":
        "*",

      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",

      "Access-Control-Allow-Methods":
        "POST, OPTIONS",
    };

    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        { headers },
      );
    }

    try {
      if (
        request.method !==
        "POST"
      ) {
        return new Response(
          JSON.stringify({
            error:
              "Method not allowed.",
          }),
          {
            status: 405,
            headers,
          },
        );
      }

      const body =
        (await request.json()) as
        ClassifyClinicRequest;

      const googlePlaceId =
        body.googlePlaceId
          ?.trim();

      const clinicName =
        body.clinicName
          ?.trim();

      const website =
        body.website
          ?.trim() ||
        null;

      if (
        !googlePlaceId ||
        !clinicName
      ) {
        return new Response(
          JSON.stringify({
            error:
              "googlePlaceId and clinicName are required.",
          }),
          {
            status: 400,
            headers,
          },
        );
      }

      const supabaseUrl =
        Deno.env.get(
          "SUPABASE_URL",
        );

      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );

      if (
        !supabaseUrl ||
        !serviceRoleKey
      ) {
        throw new Error(
          "Missing Supabase server environment variables.",
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
       * CACHE FIRST.
       */
      const {
        data:
        existingClinic,
        error:
        lookupError,
      } =
        await supabaseAdmin
          .from(
            "clinic_directory",
          )
          .select(
            `
                        google_place_id,
                        clinic_type,
                        classification_source_url,
                        verified_at,
                        nav_guarantee_accepted,
                        nav_guarantee_source_url,
                        nav_guarantee_checked_at
                        `,
          )
          .eq(
            "google_place_id",
            googlePlaceId,
          )
          .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (
        existingClinic?.verified_at &&
        existingClinic.nav_guarantee_checked_at
      ) {
        return new Response(
          JSON.stringify({
            cached: true,
            googlePlaceId,
            clinicName,

            clinicType:
              existingClinic
                .clinic_type,

            confidence:
              existingClinic.clinic_type ? "high" : "unknown",

            reason:
              "Previously classified and cached.",

            sourceUrl:
              existingClinic
                .classification_source_url ??
              null,

            acceptsNavGuarantee:
              existingClinic.nav_guarantee_accepted ?? null,

            navGuaranteeSourceUrl:
              existingClinic.nav_guarantee_source_url ?? null,
          }),
          { headers },
        );
      }

      const [classification, navGuarantee] =
        await Promise.all([
          classifyClinic(
            clinicName,
            website,
          ),
          detectNavGuarantee(website),
        ]);

      console.log(
        "Final clinic classification:",
        {
          googlePlaceId,
          clinicName,
          classification,
        },
      );

      /*
       * Cache only actual classifications.
       */
      if (classification.clinicType || website) {
        const {
          error:
          upsertError,
        } =
          await supabaseAdmin
            .from(
              "clinic_directory",
            )
            .upsert(
              {
                google_place_id:
                  googlePlaceId,

                clinic_name:
                  clinicName,

                website,

                clinic_type:
                  classification
                    .clinicType,

                classification_source_url:
                  classification
                    .sourceUrl,

                verified:
                  true,

                verified_at:
                  new Date()
                    .toISOString(),

                country_code:
                  "NO",

                nav_guarantee_accepted:
                  navGuarantee.accepted,

                nav_guarantee_source_url:
                  navGuarantee.sourceUrl,

                nav_guarantee_checked_at:
                  new Date().toISOString(),
              },
              {
                onConflict:
                  "google_place_id",
              },
            );

        if (upsertError) {
          throw upsertError;
        }
      }

      return new Response(
        JSON.stringify({
          cached: false,
          googlePlaceId,
          clinicName,
          ...classification,
          acceptsNavGuarantee:
            navGuarantee.accepted,
          navGuaranteeSourceUrl:
            navGuarantee.sourceUrl,
        }),
        { headers },
      );
    } catch (error) {
      console.error(
        "classify-clinic failed:",
        error,
      );

      let errorMessage =
        "Unknown classification error.";

      if (error instanceof Error) {
        errorMessage =
          error.message;
      } else if (
        typeof error === "string"
      ) {
        errorMessage =
          error;
      } else {
        try {
          errorMessage =
            JSON.stringify(
              error,
            );
        } catch {
          errorMessage =
            String(error);
        }
      }

      return new Response(
        JSON.stringify({
          error:
            errorMessage,
        }),
        {
          status: 500,
          headers,
        },
      );
    }
  },
);
