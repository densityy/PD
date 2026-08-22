import '@supabase/functions-js/edge-runtime.d.ts';

interface ClinicSearchRequest {
  location?: string;
  latitude?: number;
  longitude?: number;
  maxResults?: number;
}

interface GooglePlace {
  id?: string;

  displayName?: {
    text?: string;
    languageCode?: string;
  };

  formattedAddress?: string;

  location?: {
    latitude?: number;
    longitude?: number;
  };

  rating?: number;
  userRatingCount?: number;

  googleMapsUri?: string;

  websiteUri?: string;

  nationalPhoneNumber?: string;

  internationalPhoneNumber?: string;

  businessStatus?: string;

  addressComponents?: Array<{
    shortText?: string;
    types?: string[];
  }>;
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
}

interface ClinicDirectoryRow {
  id: string;
  google_place_id: string;
  clinic_name: string;

  clinic_type:
  | 'public'
  | 'private'
  | null;

  website: string | null;
  price_list_url: string | null;

  classification_source_url:
  | string
  | null;

  verified: boolean;
  verified_at: string | null;
  country_code: 'NO';
  nav_guarantee_accepted: boolean | null;
  nav_guarantee_source_url: string | null;
  nav_guarantee_checked_at: string | null;
}

type PriceSourceType =
  | 'clinic_submitted'
  | 'clinic_website'
  | 'manual'
  | 'estimated';

interface ClinicPriceRow {
  google_place_id: string;
  clinic_name: string;

  treatment_id: string;

  price_from: number | null;
  price_to: number | null;

  currency: string;

  source_type: PriceSourceType;

  source_url: string | null;

  verified_at: string | null;
}

interface TreatmentRow {
  id: string;
  code: string;
  name: string;
}

interface EnrichedClinicPriceRow
  extends ClinicPriceRow {
  treatment_code: string;
  treatment_name: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...corsHeaders,

        'Content-Type':
          'application/json',
      },
    },
  );
}

function normalizeLocation(
  location: string,
) {
  return location
    .trim()
    .replace(/\s+/g, ' ');
}

/*
 * Create a safe PostgREST "in" value.
 *
 * Example:
 *
 * ["abc", "def"]
 *
 * becomes:
 *
 * ("abc","def")
 */
function createInFilter(
  values: string[],
) {
  return `(${values
    .map(
      (value) =>
        `"${value.replace(
          /"/g,
          '\\"',
        )}"`,
    )
    .join(',')})`;
}

/*
 * Load Pocket Dentist's existing metadata and
 * ALL cached prices for the clinics returned
 * by Google Places.
 *
 * Important:
 *
 * Directory lookup and price lookup run in
 * parallel because neither depends on the other.
 */
async function fetchPocketDentistData(
  googlePlaceIds: string[],
): Promise<{
  directory: ClinicDirectoryRow[];

  prices: EnrichedClinicPriceRow[];
}> {
  const supabaseUrl =
    Deno.env.get('SUPABASE_URL');

  const serviceRoleKey =
    Deno.env.get(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    googlePlaceIds.length === 0
  ) {
    return {
      directory: [],
      prices: [],
    };
  }

  const headers = {
    apikey: serviceRoleKey,

    Authorization:
      `Bearer ${serviceRoleKey}`,
  };

  /*
   * --------------------------------------------------
   * DIRECTORY QUERY
   * --------------------------------------------------
   */

  const directoryParams =
    new URLSearchParams();

  directoryParams.set(
    'select',
    [
      'id',
      'google_place_id',
      'clinic_name',
      'clinic_type',
      'website',
      'price_list_url',
      'classification_source_url',
      'verified',
      'verified_at',
      'country_code',
      'nav_guarantee_accepted',
      'nav_guarantee_source_url',
      'nav_guarantee_checked_at',
    ].join(','),
  );

  directoryParams.set(
    'google_place_id',
    `in.${createInFilter(
      googlePlaceIds,
    )}`,
  );

  /*
   * --------------------------------------------------
   * PRICE QUERY
   * --------------------------------------------------
   */

  const priceParams =
    new URLSearchParams();

  priceParams.set(
    'select',
    [
      'google_place_id',
      'clinic_name',
      'treatment_id',
      'price_from',
      'price_to',
      'currency',
      'source_type',
      'source_url',
      'verified_at',
    ].join(','),
  );

  priceParams.set(
    'google_place_id',
    `in.${createInFilter(
      googlePlaceIds,
    )}`,
  );

  /*
   * These two requests are independent,
   * so perform them simultaneously.
   */
  const [
    directoryResponse,
    pricesResponse,
  ] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/clinic_directory?${directoryParams.toString()}`,
      {
        headers,
      },
    ),

    fetch(
      `${supabaseUrl}/rest/v1/clinic_prices?${priceParams.toString()}`,
      {
        headers,
      },
    ),
  ]);

  /*
   * --------------------------------------------------
   * DIRECTORY RESULT
   * --------------------------------------------------
   */

  let directory:
    ClinicDirectoryRow[] = [];

  if (directoryResponse.ok) {
    directory =
      (await directoryResponse.json()) as
      ClinicDirectoryRow[];
  } else {
    console.error(
      'Could not load clinic directory:',
      await directoryResponse.text(),
    );
  }

  /*
   * --------------------------------------------------
   * PRICE RESULT
   * --------------------------------------------------
   */

  let rawPrices:
    ClinicPriceRow[] = [];

  if (pricesResponse.ok) {
    rawPrices =
      (await pricesResponse.json()) as
      ClinicPriceRow[];
  } else {
    console.error(
      'Could not load clinic prices:',
      await pricesResponse.text(),
    );
  }

  if (rawPrices.length === 0) {
    return {
      directory,
      prices: [],
    };
  }

  /*
   * clinic_prices stores treatment_id.
   *
   * We need the canonical treatment code/name
   * so the frontend can keep ALL prices in
   * memory and switch treatments instantly.
   */
  const treatmentIds = [
    ...new Set(
      rawPrices
        .map(
          (price) =>
            price.treatment_id,
        )
        .filter(Boolean),
    ),
  ];

  if (treatmentIds.length === 0) {
    return {
      directory,
      prices: [],
    };
  }

  const treatmentParams =
    new URLSearchParams();

  treatmentParams.set(
    'select',
    'id,code,name',
  );

  treatmentParams.set(
    'id',
    `in.${createInFilter(
      treatmentIds,
    )}`,
  );

  const treatmentResponse =
    await fetch(
      `${supabaseUrl}/rest/v1/treatments?${treatmentParams.toString()}`,
      {
        headers,
      },
    );

  if (!treatmentResponse.ok) {
    console.error(
      'Could not load treatments:',
      await treatmentResponse.text(),
    );

    return {
      directory,
      prices: [],
    };
  }

  const treatments =
    (await treatmentResponse.json()) as
    TreatmentRow[];

  const treatmentById =
    new Map<
      string,
      TreatmentRow
    >(
      treatments.map(
        (treatment) => [
          treatment.id,
          treatment,
        ],
      ),
    );

  const prices:
    EnrichedClinicPriceRow[] = [];

  for (const price of rawPrices) {
    const treatment =
      treatmentById.get(
        price.treatment_id,
      );

    if (!treatment) {
      continue;
    }

    prices.push({
      ...price,

      treatment_code:
        treatment.code,

      treatment_name:
        treatment.name,
    });
  }

  return {
    directory,
    prices,
  };
}

function isNorwegianPlace(place: GooglePlace) {
  return place.addressComponents?.some(
    (component) =>
      component.types?.includes('country') &&
      component.shortText?.toUpperCase() === 'NO',
  ) ?? false;
}

function cacheNorwegianClinics(places: GooglePlace[]) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey || places.length === 0) return;

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };

  const rows = places.map((place) => ({
    google_place_id: place.id,
    clinic_name: place.displayName?.text ?? 'Ukjent tannklinikk',
    website: place.websiteUri ?? null,
    country_code: 'NO',
    last_seen_at: new Date().toISOString(),
  }));

  const directoryTask = fetch(`${supabaseUrl}/rest/v1/clinic_directory?on_conflict=google_place_id`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });

  const classificationTasks = places.map((place) =>
    fetch(`${supabaseUrl}/functions/v1/classify-clinic`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        googlePlaceId: place.id,
        clinicName: place.displayName?.text,
        website: place.websiteUri ?? null,
        address: place.formattedAddress ?? null,
      }),
    }).catch((error) => console.error('Could not classify clinic:', error)),
  );

  EdgeRuntime.waitUntil(Promise.allSettled([directoryTask, ...classificationTasks]));
}

Deno.serve(
  async (
    request: Request,
  ) => {
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
      const googlePlacesApiKey =
        Deno.env.get(
          'GOOGLE_PLACES_API_KEY',
        );

      if (!googlePlacesApiKey) {
        return jsonResponse(
          {
            error:
              'GOOGLE_PLACES_API_KEY is not configured.',
          },
          500,
        );
      }

      const body =
        (await request.json()) as
        ClinicSearchRequest;

      const location =
        normalizeLocation(
          body.location ?? '',
        );

      const hasCoordinates =
        typeof body.latitude ===
        'number' &&
        typeof body.longitude ===
        'number';

      if (
        hasCoordinates &&
        (
          body.latitude! < 57.5 || body.latitude! > 71.5 ||
          body.longitude! < 4 || body.longitude! > 32
        )
      ) {
        return jsonResponse({ error: 'Pocket Dentist currently searches Norway only.' }, 400);
      }

      if (
        !location &&
        !hasCoordinates
      ) {
        return jsonResponse(
          {
            error:
              'Location or coordinates are required.',
          },
          400,
        );
      }

      if (
        location.length > 100
      ) {
        return jsonResponse(
          {
            error:
              'Location is too long.',
          },
          400,
        );
      }

      const maxResults =
        Math.min(
          Math.max(
            body.maxResults ?? 8,
            1,
          ),
          10,
        );

      const googleRequestBody:
        Record<string, unknown> = {
        textQuery:
          location
            ? `tannlege i ${location}, Norge`
            : 'tannlege',

        includedType:
          'dentist',

        strictTypeFiltering:
          true,

        languageCode:
          'nb',

        regionCode:
          'NO',

        maxResultCount:
          maxResults,
      };

      if (hasCoordinates) {
        googleRequestBody.locationBias =
        {
          circle: {
            center: {
              latitude:
                body.latitude,

              longitude:
                body.longitude,
            },

            radius:
              10000,
          },
        };
      }

      /*
       * --------------------------------------------------
       * GOOGLE PLACES
       * --------------------------------------------------
       */

      const googleResponse =
        await fetch(
          'https://places.googleapis.com/v1/places:searchText',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',

              'X-Goog-Api-Key':
                googlePlacesApiKey,

              'X-Goog-FieldMask':
                [
                  'places.id',
                  'places.displayName',
                  'places.formattedAddress',
                  'places.location',
                  'places.rating',
                  'places.userRatingCount',
                  'places.googleMapsUri',
                  'places.websiteUri',
                  'places.nationalPhoneNumber',
                  'places.internationalPhoneNumber',
                  'places.businessStatus',
                  'places.addressComponents',
                ].join(','),
            },

            body:
              JSON.stringify(
                googleRequestBody,
              ),
          },
        );

      const googleData =
        (await googleResponse.json()) as
        GooglePlacesResponse & {
          error?: unknown;
        };

      if (!googleResponse.ok) {
        console.error(
          'Google Places error:',
          googleData,
        );

        return jsonResponse(
          {
            error:
              'Clinic search failed.',

            details:
              googleData.error,
          },

          googleResponse.status,
        );
      }

      const googlePlaces =
        (
          googleData.places ??
          []
        ).filter(
          (place) =>
            place.id &&
            place
              .displayName
              ?.text &&
            place.businessStatus !==
            'CLOSED_PERMANENTLY' &&
            isNorwegianPlace(place),
        );

      cacheNorwegianClinics(googlePlaces);

      const googlePlaceIds =
        googlePlaces.map(
          (place) =>
            place.id as string,
        );

      /*
       * Google search is complete.
       *
       * Now load Pocket Dentist's cached
       * metadata + ALL treatment prices.
       */
      const {
        directory,
        prices,
      } =
        await fetchPocketDentistData(
          googlePlaceIds,
        );

      /*
       * --------------------------------------------------
       * INDEX DIRECTORY BY GOOGLE PLACE ID
       * --------------------------------------------------
       */

      const directoryByGoogleId =
        new Map<
          string,
          ClinicDirectoryRow
        >(
          directory.map(
            (clinic) => [
              clinic.google_place_id,
              clinic,
            ],
          ),
        );

      /*
       * --------------------------------------------------
       * INDEX ALL PRICES BY GOOGLE PLACE ID
       * --------------------------------------------------
       */

      const pricesByGooglePlaceId =
        new Map<
          string,
          EnrichedClinicPriceRow[]
        >();

      for (
        const price of prices
      ) {
        const existing =
          pricesByGooglePlaceId.get(
            price.google_place_id,
          ) ?? [];

        existing.push(
          price,
        );

        pricesByGooglePlaceId.set(
          price.google_place_id,
          existing,
        );
      }

      /*
       * --------------------------------------------------
       * BUILD FRONTEND CLINIC OBJECTS
       * --------------------------------------------------
       */

      const clinics =
        googlePlaces.map(
          (place) => {
            const placeId =
              place.id as string;

            const verifiedClinic =
              directoryByGoogleId.get(
                placeId,
              );

            const clinicPrices =
              pricesByGooglePlaceId.get(
                placeId,
              ) ?? [];

            /*
             * Return ALL cached treatment
             * prices with each clinic.
             *
             * This allows the browser to switch
             * treatment without another database
             * request when the price is already
             * known.
             */
            const normalizedPrices =
              clinicPrices
                .filter(
                  (price) =>
                    price.price_from !==
                    null ||
                    price.price_to !==
                    null,
                )
                .map(
                  (price) => ({
                    treatment:
                      price.treatment_name,

                    treatmentCode:
                      price.treatment_code,

                    priceFrom:
                      price.price_from ??
                      undefined,

                    priceTo:
                      price.price_to ??
                      undefined,

                    currency:
                      'NOK' as const,

                    sourceType:
                      price.source_type,

                    sourceUrl:
                      price.source_url ??
                      undefined,

                    verifiedAt:
                      price.verified_at ??
                      undefined,
                  }),
                );

            return {
              id:
                placeId,

              name:
                place
                  .displayName
                  ?.text ??
                'Ukjent tannklinikk',

              address:
                place.formattedAddress ??
                '',

              city:
                location ||
                'Nær deg',

              latitude:
                place.location
                  ?.latitude ??
                null,

              longitude:
                place.location
                  ?.longitude ??
                null,

              rating:
                place.rating ??
                null,

              reviewCount:
                place.userRatingCount ??
                0,

              googleMapsUrl:
                place.googleMapsUri ??
                '',

              clinicType:
                verifiedClinic
                  ?.clinic_type ??
                null,

              countryCode:
                'NO' as const,

              acceptsNavGuarantee:
                verifiedClinic?.nav_guarantee_accepted ?? null,

              navGuaranteeSourceUrl:
                verifiedClinic?.nav_guarantee_source_url ?? null,

              navGuaranteeVerifiedAt:
                verifiedClinic?.nav_guarantee_checked_at ?? null,

              isVerified:
                verifiedClinic
                  ?.verified ??
                false,

              isPartner:
                false,

              website:
                verifiedClinic
                  ?.website ??
                place.websiteUri ??
                null,

              phone:
                place
                  .nationalPhoneNumber ??
                place
                  .internationalPhoneNumber ??
                null,

              priceListUrl:
                verifiedClinic
                  ?.price_list_url ??
                null,

              classificationSourceUrl:
                verifiedClinic
                  ?.classification_source_url ??
                null,

              verifiedAt:
                verifiedClinic
                  ?.verified_at ??
                null,

              prices:
                normalizedPrices,
            };
          },
        );

      return jsonResponse({
        location:
          location ||
          `${body.latitude},${body.longitude}`,

        source:
          'google_places',

        clinics,
      });
    } catch (error) {
      console.error(
        'Search clinics function error:',
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
  },
);
