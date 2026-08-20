import { supabase } from "@/lib/supabase";

import {
    addPricesToClinics,
} from "@/services/priceService";

import { refreshClinicPrices } from "@/services/priceRefreshService";

import type {
    Clinic,
} from "@/types/pia";

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

    latestClinics = await refreshClinicPrices({
        clinics: latestClinics,
        treatment: options.treatment,
        signal: options.signal,
        onUpdate: (update) => {
            options.onUpdate?.({
                clinics: update.clinics,
                missingPrices: update.missingClinicIds.size,
                complete: update.complete,
            });
        },
    });

    return {
        source: "live",
        clinics:
            latestClinics,
    };
}
