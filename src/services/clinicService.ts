import { supabase } from "@/lib/supabase";

import {
    addPricesToClinics,
    getTreatmentCode,
} from "@/services/priceService";

import type {
    Clinic,
} from "@/types/pia";

const PRICE_POLL_DELAY_MS = 2000;
const MAX_PRICE_POLLS = 20;

export interface ClinicSearchUpdate {
    clinics: Clinic[];
    missingPrices: number;
    complete: boolean;
}

export interface ClinicSearchOptions {
    location?: string;

    latitude?: number;
    longitude?: number;

    treatment?: string;
    openNow?: boolean;
    maxResults?: number;

    signal?: AbortSignal;

    onUpdate?: (
        update: ClinicSearchUpdate,
    ) => void;
}

export interface ClinicSearchResult {
    clinics: Clinic[];
    source:
        | "live"
        | "cached"
        | "mock";
}

interface ClinicSearchFunctionResponse {
    location?: string;
    source: string;
    clinics: Clinic[];
}

function delay(
    milliseconds: number,
) {
    return new Promise<void>(
        (resolve) => {
            window.setTimeout(
                resolve,
                milliseconds,
            );
        },
    );
}

function clinicHasPrice(
    clinic: Clinic,
) {
    return (
        Array.isArray(
            clinic.prices,
        ) &&
        clinic.prices.length > 0
    );
}

function isCancelled(
    signal?: AbortSignal,
) {
    return Boolean(
        signal?.aborted,
    );
}

function publishUpdate(
    options: ClinicSearchOptions,
    clinics: Clinic[],
    complete: boolean,
) {
    const missingPrices =
        clinics.filter(
            (clinic) =>
                !clinicHasPrice(
                    clinic,
                ),
        ).length;

    options.onUpdate?.({
        clinics,
        missingPrices,
        complete,
    });
}

async function queueMissingPrices(
    clinics: Clinic[],
    options: ClinicSearchOptions,
) {
    if (
        !options.treatment ||
        isCancelled(
            options.signal,
        )
    ) {
        return;
    }

    const treatmentCode =
        getTreatmentCode(
            options.treatment,
        ) ??
        options.treatment;

    const missingClinics =
        clinics.filter(
            (clinic) =>
                !clinicHasPrice(
                    clinic,
                ),
        );

    if (
        missingClinics.length ===
        0
    ) {
        return;
    }

    console.log(
        "PIA: queueing missing prices:",
        {
            treatmentCode,
            count:
                missingClinics.length,
        },
    );

    await Promise.allSettled(
        missingClinics.map(
            async (clinic) => {
                if (
                    isCancelled(
                        options.signal,
                    )
                ) {
                    return;
                }

                const {
                    data,
                    error,
                } =
                    await supabase.functions.invoke(
                        "queue-clinic-price-refresh",
                        {
                            body: {
                                googlePlaceId:
                                    clinic.id,

                                clinicName:
                                    clinic.name,

                                clinicCity:
                                    clinic.city ??
                                    options.location ??
                                    null,

                                sourceUrl:
                                    clinic.priceListUrl ??
                                    null,

                                websiteUrl:
                                    clinic.website ??
                                    null,

                                treatmentCode,
                            },
                        },
                    );

                if (error) {
                    console.error(
                        `PIA: could not queue price for ${clinic.name}:`,
                        error,
                    );

                    return;
                }

                console.log(
                    `PIA: price refresh queued: ${clinic.name}`,
                    data,
                );
            },
        ),
    );
}

export async function searchClinics(
    options: ClinicSearchOptions,
): Promise<ClinicSearchResult> {
    const hasCoordinates =
        Number.isFinite(
            options.latitude,
        ) &&
        Number.isFinite(
            options.longitude,
        );

    const location =
        options.location?.trim() ??
        "";

    if (
        !hasCoordinates &&
        !location
    ) {
        throw new Error(
            "Location is required.",
        );
    }

    if (
        isCancelled(
            options.signal,
        )
    ) {
        return {
            source: "live",
            clinics: [],
        };
    }

    const body =
        hasCoordinates
            ? {
                  latitude:
                      options.latitude,

                  longitude:
                      options.longitude,

                  maxResults:
                      options.maxResults ??
                      5,
              }
            : {
                  location,

                  maxResults:
                      options.maxResults ??
                      5,
              };

    const {
        data,
        error,
    } =
        await supabase.functions.invoke<ClinicSearchFunctionResponse>(
            "search-clinics",
            {
                body,
            },
        );

    if (
        isCancelled(
            options.signal,
        )
    ) {
        return {
            source: "live",
            clinics: [],
        };
    }

    if (error) {
        console.error(
            "Clinic search error:",
            error,
        );

        throw new Error(
            "Kunne ikke søke etter klinikker.",
        );
    }

    if (
        !data?.clinics ||
        !Array.isArray(
            data.clinics,
        )
    ) {
        throw new Error(
            "Klinikksøket returnerte ugyldige data.",
        );
    }

    /*
     * First price lookup is intentionally
     * cache-first.
     *
     * This means Pia can display clinics
     * immediately when Pocket Dentist already
     * knows their prices.
     */
    let latestClinics =
        await addPricesToClinics(
            data.clinics,
            options.treatment,
        );

    if (
        isCancelled(
            options.signal,
        )
    ) {
        return {
            source: "live",
            clinics:
                latestClinics,
        };
    }

    const initiallyMissing =
        latestClinics.filter(
            (clinic) =>
                !clinicHasPrice(
                    clinic,
                ),
        );

    /*
     * Let Pia render the clinic cards
     * immediately instead of waiting for
     * background price research.
     */
    publishUpdate(
        options,
        latestClinics,
        initiallyMissing.length ===
            0 ||
            !options.treatment,
    );

    if (
        !options.treatment ||
        initiallyMissing.length ===
            0
    ) {
        return {
            source: "live",
            clinics:
                latestClinics,
        };
    }

    /*
     * Missing prices use the exact same
     * backend worker pipeline as Clinic Finder.
     */
    await queueMissingPrices(
        latestClinics,
        options,
    );

    if (
        isCancelled(
            options.signal,
        )
    ) {
        return {
            source: "live",
            clinics:
                latestClinics,
        };
    }

    /*
     * Poll Pocket Dentist's published-price
     * cache while the workers research the
     * missing clinics.
     */
    for (
        let attempt = 1;
        attempt <=
        MAX_PRICE_POLLS;
        attempt++
    ) {
        await delay(
            PRICE_POLL_DELAY_MS,
        );

        if (
            isCancelled(
                options.signal,
            )
        ) {
            return {
                source: "live",
                clinics:
                    latestClinics,
            };
        }

        try {
            latestClinics =
                await addPricesToClinics(
                    latestClinics,
                    options.treatment,
                );

            if (
                isCancelled(
                    options.signal,
                )
            ) {
                return {
                    source:
                        "live",

                    clinics:
                        latestClinics,
                };
            }

            const missing =
                latestClinics.filter(
                    (clinic) =>
                        !clinicHasPrice(
                            clinic,
                        ),
                ).length;

            console.log(
                `PIA: price poll ${attempt}/${MAX_PRICE_POLLS}`,
                {
                    missing,
                    treatment:
                        options.treatment,
                },
            );

            publishUpdate(
                options,
                latestClinics,
                missing === 0,
            );

            if (
                missing === 0
            ) {
                break;
            }
        } catch (error) {
            console.error(
                "PIA: price polling failed:",
                error,
            );
        }
    }

    /*
     * Final update tells Pia to stop showing
     * "Henter pris…" even if one clinic does
     * not publish a usable price.
     */
    publishUpdate(
        options,
        latestClinics,
        true,
    );

    return {
        source: "live",
        clinics:
            latestClinics,
    };
}