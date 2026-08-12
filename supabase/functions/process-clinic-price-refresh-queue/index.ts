import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

interface QueueJob {
  id: string;
  google_place_id: string;
  clinic_name: string;
  source_url: string | null;
  treatment_code: string | null;
  status: string;
}

interface DiscoveryResult {
  discovered?: boolean;
  sourceUrl?: string;
  reason?: string;
  error?: string;
}

interface PriceCandidate {
  treatmentCode: string;
  treatmentName: string;
  priceFrom: number | null;
  priceTo: number | null;
  sourceText: string;
}

interface ImportResult {
  cached?: boolean;
  imported?: boolean;
  importId?: string;
  candidateCount?: number;
  candidates?: PriceCandidate[];
  reason?: string;
  error?: string;
}

interface ApproveResult {
  publishedCount?: number;
  clinicName?: string;
  error?: string;
}

const ALLOWED_TREATMENT_CODES = new Set([
  "examination",
  "emergency_consultation",
  "root_canal",
  "crown",
  "teeth_whitening",
  "filling",
  "dental_cleaning",
  "tooth_extraction",
  "wisdom_tooth",
  "implant",
]);

function normalizeDigits(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function sourceContainsPrice(sourceText: string, price: number) {
  return normalizeDigits(sourceText).includes(String(Math.round(price)));
}

function isCandidateSafe(candidate: PriceCandidate) {
  const reasons: string[] = [];

  const sourceText = candidate.sourceText?.trim() ?? "";

  const sourceLower = sourceText.toLowerCase();

  if (!ALLOWED_TREATMENT_CODES.has(candidate.treatmentCode)) {
    reasons.push("Ukjent behandlingskode");
  }

  if (!sourceText) {
    reasons.push("Mangler kildetekst");
  }

  if (candidate.priceFrom === null && candidate.priceTo === null) {
    reasons.push("Mangler pris");
  }

  for (const [label, price] of [
    ["fra-pris", candidate.priceFrom],
    ["til-pris", candidate.priceTo],
  ] as const) {
    if (price === null) {
      continue;
    }

    if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(price)) {
      reasons.push(`${label} er ugyldig`);

      continue;
    }

    if (!sourceContainsPrice(sourceText, price)) {
      reasons.push(`${label} finnes ikke tydelig i kildeteksten`);
    }
  }

  if (
    candidate.priceFrom !== null &&
    candidate.priceTo !== null &&
    candidate.priceTo < candidate.priceFrom
  ) {
    reasons.push("Til-pris er lavere enn fra-pris");
  }

  if (
    candidate.treatmentCode === "crown" &&
    /implantat\s*krone|implantatkrone/.test(sourceLower)
  ) {
    reasons.push("Kan være implantatkrone");
  }

  if (
    candidate.treatmentCode === "filling" &&
    /midlertidig|tempor[aæ]r/.test(sourceLower)
  ) {
    reasons.push("Kan være midlertidig fylling");
  }

  /*
   * Packages are not automatically unsafe.
   *
   * Examination prices often legitimately
   * include X-rays, cleaning or other
   * standard components.
   */
  if (
    ["examination", "dental_cleaning", "teeth_whitening"].includes(
      candidate.treatmentCode,
    )
  ) {
    const looksLikeAmbiguousPackage =
      /\b(pakkepris|behandlingspakke|package deal|kampanjepakke|totalpakke)\b/i.test(
        sourceLower,
      );

    if (looksLikeAmbiguousPackage) {
      reasons.push("Kan være uklar pakkepris");
    }
  }

  return {
    safe: reasons.length === 0,
    reasons,
  };
}

function internalHeaders(serviceRoleKey: string, adminKey: string) {
  return {
    Authorization: `Bearer ${serviceRoleKey}`,

    apikey: serviceRoleKey,

    "Content-Type": "application/json",

    "x-admin-key": adminKey,
  };
}

async function discoverPriceSource(
  supabaseUrl: string,
  serviceRoleKey: string,
  adminKey: string,
  jobId: string,
) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/discover-clinic-price-source`,
    {
      method: "POST",

      headers: internalHeaders(serviceRoleKey, adminKey),

      body: JSON.stringify({
        jobId,
      }),
    },
  );

  const result = (await response.json()) as DiscoveryResult;

  return {
    response,
    result,
  };
}

async function importFromSource(
  supabaseUrl: string,
  serviceRoleKey: string,
  adminKey: string,
  job: QueueJob,
  sourceUrl: string,
) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/import-clinic-prices`,
    {
      method: "POST",

      headers: internalHeaders(serviceRoleKey, adminKey),

      body: JSON.stringify({
        googlePlaceId: job.google_place_id,

        clinicName: job.clinic_name,

        sourceUrl,

        /*
         * Important:
         * Do NOT limit HTML extraction to the one treatment
         * that triggered the refresh.
         *
         * A clinic price page should be crawled once and all
         * supported treatment prices should be extracted.
         */
        treatmentCode: null,

        forceRefresh: true,
      }),
    },
  );

  const result = (await response.json()) as ImportResult;

  if (!response.ok) {
    throw new Error(result.error ?? "Price extraction failed.");
  }

  return result;
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

    const adminKey = Deno.env.get("PRICE_IMPORT_ADMIN_KEY");

    if (!supabaseUrl || !serviceRoleKey || !adminKey) {
      return jsonResponse(
        {
          error: "Server credentials missing.",
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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,

        autoRefreshToken: false,
      },
    });

    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from("clinic_price_refresh_queue")
      .select(
        `
                        id,
                        google_place_id,
                        clinic_name,
                        source_url,
                        treatment_code,
                        status
                    `,
      )
      .eq("status", "pending")
      .order("requested_at", {
        ascending: true,
      })
      .limit(10);

    if (jobsError) {
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      return jsonResponse({
        processedCount: 0,

        results: [],
      });
    }

    const results: Record<string, unknown>[] = [];

    for (const job of jobs as QueueJob[]) {
      let sourceUrl: string | null = job.source_url;

      try {
        /*
         * Atomically claim job.
         */
        const { data: claimed, error: claimError } = await supabaseAdmin
          .from("clinic_price_refresh_queue")
          .update({
            status: "processing",

            started_at: new Date().toISOString(),

            error_message: null,
          })
          .eq("id", job.id)
          .eq("status", "pending")
          .select("id");

        if (claimError) {
          throw claimError;
        }

        if (!claimed || claimed.length === 0) {
          continue;
        }

        /*
         * No source yet:
         * discover one.
         */
        if (!sourceUrl) {
          const { response, result } = await discoverPriceSource(
            supabaseUrl,
            serviceRoleKey,
            adminKey,
            job.id,
          );

          if (!response.ok || !result.discovered || !result.sourceUrl) {
            throw new Error(
              result.error ?? result.reason ?? "No official price page found.",
            );
          }

          sourceUrl = result.sourceUrl;
        }

        /*
         * TypeScript now knows that
         * sourceUrl is a real string.
         */
        if (!sourceUrl) {
          throw new Error("Price source URL is missing.");
        }

        /*
         * Attempt 1:
         * current price source.
         */
        let importResult = await importFromSource(
          supabaseUrl,
          serviceRoleKey,
          adminKey,
          job,
          sourceUrl,
        );

        /*
         * Treatment not found.
         *
         * The existing source may be
         * stale, wrong, or a patient
         * portal rather than the actual
         * public price list.
         */
        if (!importResult.imported || !importResult.importId) {
          const oldSourceUrl = sourceUrl;

          console.log("Treatment missing from current source. Rediscovering.", {
            clinic: job.clinic_name,

            treatment: job.treatment_code,

            oldSourceUrl,

            reason: importResult.reason,
          });

          /*
           * Clear old source so discovery
           * cannot simply inherit it.
           */
          const { error: clearSourceError } = await supabaseAdmin
            .from("clinic_price_refresh_queue")
            .update({
              source_url: null,
            })
            .eq("id", job.id);

          if (clearSourceError) {
            console.error("Could not clear stale source:", clearSourceError);
          }

          const {
            response: rediscoveryResponse,

            result: rediscoveryResult,
          } = await discoverPriceSource(
            supabaseUrl,
            serviceRoleKey,
            adminKey,
            job.id,
          );

          if (
            rediscoveryResponse.ok &&
            rediscoveryResult.discovered &&
            rediscoveryResult.sourceUrl
          ) {
            const newSourceUrl = rediscoveryResult.sourceUrl;

            console.log("Rediscovered price source:", {
              clinic: job.clinic_name,

              treatment: job.treatment_code,

              oldSourceUrl,

              newSourceUrl,
            });

            /*
             * Only retry if discovery
             * actually gave us another
             * source.
             */
            sourceUrl = newSourceUrl;

            importResult = await importFromSource(
              supabaseUrl,
              serviceRoleKey,
              adminKey,
              job,
              sourceUrl,
            );
          } else {
            /*
             * Keep old URL for useful
             * diagnostics if rediscovery
             * completely fails.
             */
            sourceUrl = oldSourceUrl;

            console.log("Price source rediscovery failed:", {
              clinic: job.clinic_name,

              treatment: job.treatment_code,

              reason: rediscoveryResult.reason ?? rediscoveryResult.error,
            });
          }
        }

        /*
         * Still nothing after both
         * extraction attempts.
         */
        if (!importResult.imported || !importResult.importId) {
          await supabaseAdmin
            .from("clinic_price_refresh_queue")
            .update({
              status: "completed",

              source_url: sourceUrl,

              completed_at: new Date().toISOString(),

              error_message:
                importResult.reason ??
                "Treatment price not found after source rediscovery.",
            })
            .eq("id", job.id);

          results.push({
            clinic: job.clinic_name,

            treatment: job.treatment_code,

            published: false,

            reason:
              importResult.reason ?? "Price not found after source rediscovery",
          });

          continue;
        }

        const candidates = Array.isArray(importResult.candidates)
          ? importResult.candidates
          : [];

        /*
         * We normally expect exactly
         * one requested treatment.
         */
        const safeCandidates: PriceCandidate[] = [];

        const unsafeCandidates: Array<{
          candidate: PriceCandidate;
          reasons: string[];
        }> = [];

        for (const candidate of candidates) {
          const safety = isCandidateSafe(candidate);

          if (safety.safe) {
            safeCandidates.push(candidate);
          } else {
            unsafeCandidates.push({
              candidate,
              reasons: safety.reasons,
            });
          }
        }

        /*
         * The treatment that triggered the refresh still matters
         * to the UI, but it no longer limits what we extract/store.
         */
        const requestedCandidate = job.treatment_code
          ? candidates.find(
            (candidate) =>
              candidate.treatmentCode === job.treatment_code,
          )
          : null;

        if (
          job.treatment_code &&
          !requestedCandidate
        ) {
          throw new Error("Requested treatment candidate missing.");
        }

        /*
         * If nothing from this clinic is safe enough to publish,
         * leave the import available for manual review.
         */
        if (safeCandidates.length === 0) {
          const requestedUnsafe = job.treatment_code
            ? unsafeCandidates.find(
              ({ candidate }) =>
                candidate.treatmentCode === job.treatment_code,
            )
            : unsafeCandidates[0];

          await supabaseAdmin
            .from("clinic_price_refresh_queue")
            .update({
              status: "completed",

              source_url: sourceUrl,

              completed_at: new Date().toISOString(),

              error_message: requestedUnsafe
                ? `Manual review: ${requestedUnsafe.reasons.join(", ")}`
                : "No safe treatment prices found.",
            })
            .eq("id", job.id);

          results.push({
            clinic: job.clinic_name,

            treatment: job.treatment_code,

            published: false,

            manualReview: unsafeCandidates.length > 0,

            reasons: requestedUnsafe?.reasons ?? [],
          });

          continue;
        }

        /*
         * Publish every safe treatment found during this clinic crawl.
         */
        const approveResponse = await fetch(
          `${supabaseUrl}/functions/v1/approve-clinic-price-import`,
          {
            method: "POST",

            headers: internalHeaders(serviceRoleKey, adminKey),

            body: JSON.stringify({
              importId: importResult.importId,

              candidates: safeCandidates.map(
                (candidate) => ({
                  treatmentCode: candidate.treatmentCode,

                  priceFrom: candidate.priceFrom,

                  priceTo: candidate.priceTo,
                }),
              ),
            }),
          },
        );

        const approveResult = (await approveResponse.json()) as ApproveResult;

        if (!approveResponse.ok) {
          throw new Error(approveResult.error ?? "Auto approval failed.");
        }

        await supabaseAdmin
          .from("clinic_price_refresh_queue")
          .update({
            status: "completed",

            source_url: sourceUrl,

            completed_at: new Date().toISOString(),

            error_message:
              unsafeCandidates.length > 0
                ? `Some candidates need manual review: ${unsafeCandidates
                  .map(
                    ({ candidate }) =>
                      candidate.treatmentCode,
                  )
                  .join(", ")}`
                : null,
          })
          .eq("id", job.id);

        results.push({
          clinic: job.clinic_name,

          treatment: job.treatment_code,

          published: true,

          publishedCount: safeCandidates.length,

          publishedTreatments: safeCandidates.map(
            (candidate) =>
              candidate.treatmentCode,
          ),

          requestedPrice: requestedCandidate
            ? {
              priceFrom: requestedCandidate.priceFrom,
              priceTo: requestedCandidate.priceTo,
            }
            : null,

          manualReviewTreatments: unsafeCandidates.map(
            ({ candidate }) =>
              candidate.treatmentCode,
          ),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        console.error(`Refresh failed: ${job.clinic_name}`, error);

        await supabaseAdmin
          .from("clinic_price_refresh_queue")
          .update({
            status: "error",

            source_url: sourceUrl,

            completed_at: new Date().toISOString(),

            error_message: message,
          })
          .eq("id", job.id);

        results.push({
          clinic: job.clinic_name,

          treatment: job.treatment_code,

          published: false,

          error: message,
        });
      }
    }

    return jsonResponse({
      processedCount: results.length,

      results,
    });
  } catch (error) {
    console.error("Processor error:", error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error.",
      },
      500,
    );
  }
});
