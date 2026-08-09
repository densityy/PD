import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface DiscoverRequest {
  jobId: string;
}

interface SiteLink {
  url: string;
  text: string;
}

interface ScoredUrl {
  url: string;
  score: number;
  reason?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function stripTrackingParams(url: string) {
  try {
    const parsed = new URL(url);

    const blockedPrefixes = ["utm_", "gclid", "fbclid", "od"];

    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase();

      if (blockedPrefixes.some((prefix) => lower.startsWith(prefix))) {
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
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9\s/_?=&.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function sameSite(first: string, second: string) {
  const a = normalizeHost(first);

  const b = normalizeHost(second);

  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function getClinicNameTokens(clinicName: string) {
  const stopWords = new Set([
    "tannlege",
    "tannlegen",
    "tannleger",
    "tannklinikk",
    "tannklinikken",
    "tannlegesenter",
    "tannlegesenteret",
    "dental",
    "clinic",
    "klinikk",
    "as",
    "avdeling",
  ]);

  return normalizeText(clinicName)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function getCityTokens(city?: string | null) {
  if (!city) {
    return [];
  }

  return normalizeText(city)
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function extractSiteLinks(html: string, pageUrl: string) {
  const base = new URL(pageUrl);

  const links: SiteLink[] = [];

  const regex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const href = decodeHtml(match[1]);

      const text = cleanPageText(match[2]);

      const url = new URL(href, pageUrl);

      if (!sameSite(url.hostname, base.hostname)) {
        continue;
      }

      if (!["http:", "https:"].includes(url.protocol)) {
        continue;
      }

      links.push({
        url: stripTrackingParams(url.toString()),

        text,
      });
    } catch {
      // Ignore malformed links.
    }
  }

  const deduped = new Map<string, SiteLink>();

  for (const link of links) {
    if (!deduped.has(link.url)) {
      deduped.set(link.url, link);
    }
  }

  return [...deduped.values()];
}

async function fetchHtml(url: string) {
  try {
    const response = await fetch(url, {
      redirect: "follow",

      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PocketDentistPriceDiscovery/2.0)",

        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html")) {
      return null;
    }

    return {
      html: await response.text(),

      finalUrl: stripTrackingParams(response.url || url),
    };
  } catch {
    return null;
  }
}

function branchLinkScore(
  link: SiteLink,
  clinicName: string,
  clinicCity?: string | null,
) {
  const searchable = normalizeText(`${link.url} ${link.text}`);

  const cityTokens = getCityTokens(clinicCity);

  const clinicTokens = getClinicNameTokens(clinicName);

  let score = 0;

  for (const city of cityTokens) {
    if (searchable.includes(city)) {
      score += 30;
    }
  }

  for (const token of clinicTokens) {
    if (searchable.includes(token)) {
      score += 5;
    }
  }

  if (searchable.includes("avdeling")) {
    score += 4;
  }

  if (searchable.includes("klinikk")) {
    score += 3;
  }

  if (searchable.includes("kontakt")) {
    score += 2;
  }

  return score;
}

function branchPageScore(
  html: string,
  url: string,
  clinicName: string,
  clinicCity?: string | null,
) {
  const text = normalizeText(cleanPageText(html));

  const normalizedUrl = normalizeText(url);

  const cityTokens = getCityTokens(clinicCity);

  const clinicTokens = getClinicNameTokens(clinicName);

  let score = 0;

  for (const city of cityTokens) {
    if (normalizedUrl.includes(city)) {
      score += 30;
    }

    if (text.includes(city)) {
      score += 12;
    }
  }

  for (const token of clinicTokens) {
    if (normalizedUrl.includes(token)) {
      score += 6;
    }

    if (text.includes(token)) {
      score += 3;
    }
  }

  return score;
}

function pricePageScore(html: string, url: string, clinicCity?: string | null) {
  const rawText = cleanPageText(html);

  const text = normalizeText(rawText);

  const normalizedUrl = normalizeText(url);

  /*
   * Reject patient portals, login areas and booking systems
   * at the FINAL fetched-page level.
   *
   * Link scoring alone is not enough because redirects can
   * still land on a portal such as minside.
   */
  const portalTerms = [
    "minside",
    "min-side",
    "login",
    "logg-inn",
    "logginn",
    "booking",
    "bestill-time",
    "bestilltime",
    "konto",
    "portal",
  ];

  if (
    portalTerms.some((term) =>
      normalizedUrl.includes(normalizeText(term))
    )
  ) {
    return -100;
  }

  let score = 0;

  const strongUrlTerms = [
    "/priser",
    "/prisliste",
    "/pris",
    "/price",
    "/prices",
    "behandlinger-og-priser",
    "priser-og-betaling",
    "priser-og-refusjon",
    "tannlege-priser",
    "behandlingspriser",
  ];

  for (const term of strongUrlTerms) {
    if (normalizedUrl.includes(normalizeText(term))) {
      score += 10;
    }
  }

  const headingTerms = [
    "prisliste",
    "priser",
    "behandlingspriser",
    "tannlegepriser",
    "prisoversikt",
  ];

  for (const term of headingTerms) {
    if (text.includes(term)) {
      score += 4;
    }
  }

  const dentalTerms = [
    "undersokelse",
    "akutt",
    "fylling",
    "rotfylling",
    "rotbehandling",
    "krone",
    "implantat",
    "tannbleking",
    "bleking",
    "tannrens",
    "rens",
    "tanntrekking",
    "trekking",
    "visdomstann",
  ];

  const dentalMatches = dentalTerms.filter((term) =>
    text.includes(term),
  ).length;

  score += dentalMatches * 2;

  const currencyPatterns = [
    /\bkr\s?\d/gi,
    /\d[\d\s.]*\s?kr\b/gi,
    /\d[\d\s.]*,-/gi,
  ];

  let priceHits = 0;

  for (const pattern of currencyPatterns) {
    priceHits += rawText.match(pattern)?.length ?? 0;
  }

  score += Math.min(priceHits, 15);

  if (clinicCity) {
    const city = normalizeText(clinicCity);

    if (normalizedUrl.includes(city)) {
      score += 20;
    }

    if (text.includes(city)) {
      score += 8;
    }
  }

  return score;
}

function priceLinkScore(link: SiteLink, clinicCity?: string | null) {
  const searchable = normalizeText(`${link.url} ${link.text}`);

  let score = 0;

  /*
   * Patient portals, booking systems and account
   * pages are usually bad sources for public
   * treatment-price extraction.
   */
  const portalTerms = [
    "minside",
    "min-side",
    "login",
    "logg-inn",
    "logginn",
    "booking",
    "bestill-time",
    "bestilltime",
    "konto",
    "portal",
  ];

  if (portalTerms.some((term) => searchable.includes(term))) {
    score -= 60;
  }

  if (searchable.includes("prisliste")) {
    score += 30;
  }

  if (searchable.includes("priser-tannlegebehandling")) {
    score += 35;
  }

  if (searchable.includes("behandlingspriser")) {
    score += 30;
  }

  if (searchable.includes("priser")) {
    score += 25;
  }

  if (searchable.includes("pris")) {
    score += 15;
  }

  if (searchable.includes("price")) {
    score += 12;
  }

  if (searchable.includes("betaling") || searchable.includes("refusjon")) {
    score += 5;
  }

  if (clinicCity) {
    const city = normalizeText(clinicCity);

    if (searchable.includes(city)) {
      score += 25;
    }
  }

  return score;
}

function locationSpecificLinkScore(link: SiteLink, clinicCity?: string | null) {
  if (!clinicCity) {
    return 0;
  }

  const searchable = normalizeText(`${link.url} ${link.text}`);

  const city = normalizeText(clinicCity);

  if (!searchable.includes(city)) {
    return 0;
  }

  let score = 35;

  if (searchable.includes("pris") || searchable.includes("price")) {
    score += 25;
  }

  if (searchable.includes("klinikk") || searchable.includes("avdeling")) {
    score += 10;
  }

  return score;
}

async function getGoogleWebsite(
  googlePlaceId: string,
  googlePlacesApiKey: string,
) {
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(
        googlePlaceId,
      )}`,
      {
        headers: {
          "X-Goog-Api-Key": googlePlacesApiKey,

          "X-Goog-FieldMask": "websiteUri",
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const body = await response.json();

    if (typeof body.websiteUri !== "string") {
      return null;
    }

    return stripTrackingParams(body.websiteUri);
  } catch {
    return null;
  }
}

/*
 * Find the clinic's specific branch/location page.
 *
 * Example:
 *
 * Tannfeen Tønsberg
 * tannfeen.no
 *
 * We prefer the Tønsberg branch page before
 * attempting to locate prices.
 */
async function findBranchPage(
  homepageHtml: string,
  homepageUrl: string,
  clinicName: string,
  clinicCity?: string | null,
) {
  if (!clinicCity) {
    return null;
  }

  const links = extractSiteLinks(homepageHtml, homepageUrl);

  const ranked = links
    .map((link) => ({
      ...link,

      score: branchLinkScore(link, clinicName, clinicCity),
    }))
    .filter((link) => link.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  let best: ScoredUrl | null = null;

  for (const candidate of ranked) {
    const page = await fetchHtml(candidate.url);

    if (!page) {
      continue;
    }

    const score = branchPageScore(
      page.html,
      page.finalUrl,
      clinicName,
      clinicCity,
    );

    console.log("Branch candidate:", {
      clinicName,
      clinicCity,
      url: page.finalUrl,
      score,
    });

    if (!best || score > best.score) {
      best = {
        url: page.finalUrl,

        score,

        reason: "branch-page",
      };
    }

    if (score >= 40) {
      break;
    }
  }

  return best;
}

/*
 * A price page itself may contain links for
 * individual cities.
 *
 * Example:
 *
 * /priser
 *   → Velg Tønsberg
 *   → location-specific URL
 *
 * We inspect those links before accepting the
 * generic chain price page.
 */
async function findLocationPricePage(
  pricePageHtml: string,
  pricePageUrl: string,
  clinicCity?: string | null,
) {
  if (!clinicCity) {
    return null;
  }

  const links = extractSiteLinks(pricePageHtml, pricePageUrl);

  const ranked = links
    .map((link) => ({
      ...link,

      score: locationSpecificLinkScore(link, clinicCity),
    }))
    .filter((link) => link.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  let best: ScoredUrl | null = null;

  for (const candidate of ranked) {
    const page = await fetchHtml(candidate.url);

    if (!page) {
      continue;
    }

    const score = pricePageScore(page.html, page.finalUrl, clinicCity);

    console.log("Location price candidate:", {
      clinicCity,

      url: page.finalUrl,

      score,
    });

    if (!best || score > best.score) {
      best = {
        url: page.finalUrl,

        score,

        reason: "location-price-page",
      };
    }
  }

  return best;
}

async function discoverPriceFromContext(
  contextHtml: string,
  contextUrl: string,
  clinicCity?: string | null,
) {
  const contextHost = new URL(contextUrl).hostname;

  const links = extractSiteLinks(contextHtml, contextUrl);

  const rankedLinks = links
    .map((link) => ({
      ...link,

      score: priceLinkScore(link, clinicCity),
    }))
    .filter((link) => link.score > 0)
    .sort((a, b) => b.score - a.score);

  const commonPaths = [
    "/priser",
    "/priser/",
    "/priser-tannlegebehandling",
    "/priser-tannlegebehandling/",
    "/tannlegepriser",
    "/tannlegepriser/",
    "/prisliste",
    "/prisliste/",
    "/pris",
    "/pris/",
    "/priser-og-betaling",
    "/priser-og-betaling/",
    "/priser-og-refusjon",
    "/priser-og-refusjon/",
    "/behandlinger-og-priser",
    "/behandlinger-og-priser/",
    "/behandlinger/priser",
    "/behandlinger/priser/",
    "/tannlege-priser",
    "/tannlege-priser/",
    "/behandlingspriser",
    "/behandlingspriser/",
    "/prices",
    "/prices/",
    "/price-list",
    "/price-list/",
  ];

  const rawCandidates = [
    ...rankedLinks.map((link) => link.url),

    ...commonPaths.map((path) => new URL(path, contextUrl).toString()),
  ];

  const candidates = [...new Set(rawCandidates.map(stripTrackingParams))].slice(
    0,
    35,
  );

  let best: {
    url: string;
    score: number;
    html: string;
  } | null = null;

  for (const candidateUrl of candidates) {
    try {
      const candidate = new URL(candidateUrl);

      if (!sameSite(candidate.hostname, contextHost)) {
        continue;
      }

      const page = await fetchHtml(candidateUrl);

      if (!page) {
        continue;
      }

      const score = pricePageScore(page.html, page.finalUrl, clinicCity);

      console.log("Price source candidate:", {
        url: page.finalUrl,

        score,

        clinicCity,
      });

      if (!best || score > best.score) {
        best = {
          url: page.finalUrl,

          score,

          html: page.html,
        };
      }

      /*
       * Don't stop too early merely because
       * a generic chain /priser page is strong.
       *
       * City-aware pages should win.
       */
      const city = normalizeText(clinicCity ?? "");

      const urlText = normalizeText(page.finalUrl);

      if (score >= 30 && city && urlText.includes(city)) {
        break;
      }
    } catch {
      // Try next URL.
    }
  }

  return best;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed.",
      },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const googlePlacesApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

    const adminKey = Deno.env.get("PRICE_IMPORT_ADMIN_KEY");

    if (!supabaseUrl || !serviceRoleKey || !googlePlacesApiKey || !adminKey) {
      return jsonResponse(
        {
          error: "Server credentials are not configured.",
        },
        500,
      );
    }

    if (request.headers.get("x-admin-key") !== adminKey) {
      return jsonResponse(
        {
          error: "Unauthorized.",
        },
        401,
      );
    }

    const body = (await request.json()) as DiscoverRequest;

    const jobId = body.jobId?.trim();

    if (!jobId) {
      return jsonResponse(
        {
          error: "jobId is required.",
        },
        400,
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,

        autoRefreshToken: false,
      },
    });

    const { data: job, error: jobError } = await supabaseAdmin
      .from("clinic_price_refresh_queue")
      .select(
        `
                    id,
                    google_place_id,
                    clinic_name,
                    clinic_city,
                    website_url,
                    source_url,
                    treatment_code,
                    status
                `,
      )
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      console.error("Could not load refresh job:", jobError);

      return jsonResponse(
        {
          error: "Could not load refresh job.",
        },
        500,
      );
    }

    if (!job) {
      return jsonResponse(
        {
          error: "Refresh job was not found.",
        },
        404,
      );
    }

    /*
     * Use website passed from Clinic Finder first.
     */
    let websiteUrl =
      typeof job.website_url === "string" && job.website_url.trim()
        ? stripTrackingParams(job.website_url.trim())
        : null;

    if (!websiteUrl) {
      websiteUrl = await getGoogleWebsite(
        job.google_place_id,
        googlePlacesApiKey,
      );
    }

    if (!websiteUrl) {
      return jsonResponse({
        discovered: false,

        reason: "Clinic has no official website listed by Google.",
      });
    }

    let website: URL;

    try {
      website = new URL(websiteUrl);
    } catch {
      return jsonResponse({
        discovered: false,

        reason: "Clinic website URL is invalid.",
      });
    }

    const homepage = await fetchHtml(websiteUrl);

    if (!homepage) {
      return jsonResponse({
        discovered: false,

        websiteUrl,

        reason: "Could not load clinic website.",
      });
    }

    const canonicalWebsite = homepage.finalUrl;

    await supabaseAdmin
      .from("clinic_price_refresh_queue")
      .update({
        website_url: canonicalWebsite,
      })
      .eq("id", job.id);

    /*
     * STEP 1
     *
     * Find this exact clinic/branch.
     */
    const branch = await findBranchPage(
      homepage.html,
      homepage.finalUrl,
      job.clinic_name,
      job.clinic_city,
    );

    console.log("Branch resolution:", {
      clinic: job.clinic_name,

      city: job.clinic_city,

      branch,
    });

    let contextUrl = homepage.finalUrl;

    let contextHtml = homepage.html;

    if (branch) {
      const branchPage = await fetchHtml(branch.url);

      if (branchPage) {
        contextUrl = branchPage.finalUrl;

        contextHtml = branchPage.html;
      }
    }

    /*
     * STEP 2
     *
     * Find prices starting from the branch page.
     */
    let pricePage = await discoverPriceFromContext(
      contextHtml,
      contextUrl,
      job.clinic_city,
    );

    /*
     * STEP 3
     *
     * If branch page didn't expose prices,
     * search from homepage too.
     */
    if (!pricePage || pricePage.score < 12) {
      const homepagePricePage = await discoverPriceFromContext(
        homepage.html,
        homepage.finalUrl,
        job.clinic_city,
      );

      if (
        homepagePricePage &&
        (!pricePage || homepagePricePage.score > pricePage.score)
      ) {
        pricePage = homepagePricePage;
      }
    }

    /*
     * STEP 4
     *
     * Generic chain price pages may contain
     * links/selectors for locations.
     *
     * Look for a city-specific price page
     * before accepting the generic one.
     */
    if (pricePage) {
      const locationPricePage = await findLocationPricePage(
        pricePage.html,
        pricePage.url,
        job.clinic_city,
      );

      if (locationPricePage && locationPricePage.score >= pricePage.score) {
        const locationPage = await fetchHtml(locationPricePage.url);

        if (locationPage) {
          pricePage = {
            url: locationPage.finalUrl,

            html: locationPage.html,

            score: locationPricePage.score,
          };
        }
      }
    }

    /*
     * Homepage itself can occasionally be
     * the price page.
     */
    if (!pricePage) {
      const homepageScore = pricePageScore(
        homepage.html,
        homepage.finalUrl,
        job.clinic_city,
      );

      if (homepageScore >= 18) {
        pricePage = {
          url: homepage.finalUrl,

          html: homepage.html,

          score: homepageScore,
        };
      }
    }

    if (!pricePage || pricePage.score < 12) {
      return jsonResponse({
        discovered: false,

        websiteUrl: homepage.finalUrl,

        branchUrl: branch?.url ?? null,

        bestScore: pricePage?.score ?? 0,

        reason: "No verified price page was found.",
      });
    }

    const cleanBestUrl = stripTrackingParams(pricePage.url);

    /*
     * Safety information in logs.
     */
    console.log("Selected price source:", {
      clinic: job.clinic_name,

      city: job.clinic_city,

      website: homepage.finalUrl,

      branch: branch?.url ?? null,

      priceSource: cleanBestUrl,

      score: pricePage.score,
    });

    const { error: updateError } = await supabaseAdmin
      .from("clinic_price_refresh_queue")
      .update({
        website_url: homepage.finalUrl,

        source_url: cleanBestUrl,
      })
      .eq("id", job.id);

    if (updateError) {
      console.error("Could not save discovered price source:", updateError);

      return jsonResponse(
        {
          error: "Price source was found but could not be saved.",
        },
        500,
      );
    }

    return jsonResponse({
      discovered: true,

      clinicName: job.clinic_name,

      clinicCity: job.clinic_city,

      websiteUrl: homepage.finalUrl,

      branchUrl: branch?.url ?? null,

      sourceUrl: cleanBestUrl,

      score: pricePage.score,
    });
  } catch (error) {
    console.error("Price source discovery error:", error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown server error.",
      },
      500,
    );
  }
});
