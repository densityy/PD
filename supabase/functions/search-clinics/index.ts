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
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
}

interface ClinicDirectoryRow {
  id: string;
  google_place_id: string;
  clinic_name: string;
  clinic_type: 'public' | 'private' | null;
  website: string | null;
  price_list_url: string | null;
  classification_source_url: string | null;
  verified: boolean;
  verified_at: string | null;
}

interface ClinicPriceRow {
  id: string;
  clinic_id: string;
  treatment_code: string;
  treatment_name: string;
  price_nok: number | null;
  price_note: string | null;
  source_url: string | null;
  verified_at: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
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

function normalizeLocation(location: string) {
  return location.trim().replace(/\s+/g, ' ');
}

async function fetchPocketDentistData(
  googlePlaceIds: string[],
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get(
    'SUPABASE_SERVICE_ROLE_KEY',
  );

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    googlePlaceIds.length === 0
  ) {
    return {
      directory: [] as ClinicDirectoryRow[],
      prices: [] as ClinicPriceRow[],
    };
  }

  const directoryParams = new URLSearchParams();

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
    ].join(','),
  );

  directoryParams.set(
    'google_place_id',
    `in.(${googlePlaceIds.join(',')})`,
  );

  const directoryResponse = await fetch(
    `${supabaseUrl}/rest/v1/clinic_directory?${directoryParams.toString()}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!directoryResponse.ok) {
    console.error(
      'Could not load clinic directory:',
      await directoryResponse.text(),
    );

    return {
      directory: [] as ClinicDirectoryRow[],
      prices: [] as ClinicPriceRow[],
    };
  }

  const directory =
    (await directoryResponse.json()) as ClinicDirectoryRow[];

  if (directory.length === 0) {
    return {
      directory,
      prices: [] as ClinicPriceRow[],
    };
  }

  const clinicIds = directory.map(
    (clinic) => clinic.id,
  );

  const priceParams = new URLSearchParams();

  priceParams.set(
    'select',
    [
      'id',
      'clinic_id',
      'treatment_code',
      'treatment_name',
      'price_nok',
      'price_note',
      'source_url',
      'verified_at',
    ].join(','),
  );

  priceParams.set(
    'clinic_id',
    `in.(${clinicIds.join(',')})`,
  );

  const pricesResponse = await fetch(
    `${supabaseUrl}/rest/v1/clinic_prices?${priceParams.toString()}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!pricesResponse.ok) {
    console.error(
      'Could not load clinic prices:',
      await pricesResponse.text(),
    );

    return {
      directory,
      prices: [] as ClinicPriceRow[],
    };
  }

  const prices =
    (await pricesResponse.json()) as ClinicPriceRow[];

  return {
    directory,
    prices,
  };
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
    const googlePlacesApiKey = Deno.env.get(
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
      (await request.json()) as ClinicSearchRequest;

    const location = normalizeLocation(
      body.location ?? '',
    );

    const hasCoordinates =
      typeof body.latitude === 'number' &&
      typeof body.longitude === 'number';

    if (!location && !hasCoordinates) {
      return jsonResponse(
        {
          error:
            'Location or coordinates are required.',
        },
        400,
      );
    }

    if (location.length > 100) {
      return jsonResponse(
        {
          error: 'Location is too long.',
        },
        400,
      );
    }

    const maxResults = Math.min(
      Math.max(body.maxResults ?? 8, 1),
      10,
    );

    const googleRequestBody: Record<
      string,
      unknown
    > = {
      textQuery: location
        ? `tannlege i ${location}, Norge`
        : 'tannlege',
      includedType: 'dentist',
      strictTypeFiltering: true,
      languageCode: 'nb',
      regionCode: 'NO',
      maxResultCount: maxResults,
    };

    if (hasCoordinates) {
      googleRequestBody.locationBias = {
        circle: {
          center: {
            latitude: body.latitude,
            longitude: body.longitude,
          },
          radius: 10000,
        },
      };
    }

    const googleResponse = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key':
            googlePlacesApiKey,
          'X-Goog-FieldMask': [
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
          ].join(','),
        },
        body: JSON.stringify(
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
          error: 'Clinic search failed.',
          details: googleData.error,
        },
        googleResponse.status,
      );
    }

    const googlePlaces = (
      googleData.places ?? []
    ).filter(
      (place) =>
        place.id &&
        place.displayName?.text &&
        place.businessStatus !==
        'CLOSED_PERMANENTLY',
    );

    const googlePlaceIds = googlePlaces.map(
      (place) => place.id as string,
    );

    const {
      directory,
      prices,
    } = await fetchPocketDentistData(
      googlePlaceIds,
    );

    const directoryByGoogleId = new Map(
      directory.map((clinic) => [
        clinic.google_place_id,
        clinic,
      ]),
    );

    const pricesByClinicId = new Map<
      string,
      ClinicPriceRow[]
    >();

    for (const price of prices) {
      const existing =
        pricesByClinicId.get(price.clinic_id) ?? [];

      existing.push(price);

      pricesByClinicId.set(
        price.clinic_id,
        existing,
      );
    }

    const clinics = googlePlaces.map(
      (place) => {
        const placeId = place.id as string;

        const verifiedClinic =
          directoryByGoogleId.get(placeId);

        const clinicPrices = verifiedClinic
          ? pricesByClinicId.get(
            verifiedClinic.id,
          ) ?? []
          : [];

        const priceMap = Object.fromEntries(
          clinicPrices.map((price) => [
            price.treatment_code,
            {
              treatmentName:
                price.treatment_name,
              priceNok: price.price_nok,
              priceNote: price.price_note,
              sourceUrl: price.source_url,
              verifiedAt:
                price.verified_at,
            },
          ]),
        );

        return {
          id: placeId,

          name:
            place.displayName?.text ??
            'Ukjent tannklinikk',

          address:
            place.formattedAddress ?? '',

          city: location || 'Nær deg',

          latitude:
            place.location?.latitude ?? null,

          longitude:
            place.location?.longitude ?? null,

          rating:
            place.rating ?? null,

          reviewCount:
            place.userRatingCount ?? 0,

          googleMapsUrl:
            place.googleMapsUri ?? '',

          clinicType:
            verifiedClinic?.clinic_type ??
            null,

          isVerified:
            verifiedClinic?.verified ??
            false,

          isPartner: false,

          website:
            verifiedClinic?.website ??
            place.websiteUri ??
            null,

          phone:
            place.nationalPhoneNumber ??
            place.internationalPhoneNumber ??
            null,

          priceListUrl:
            verifiedClinic?.price_list_url ??
            null,

          classificationSourceUrl:
            verifiedClinic
              ?.classification_source_url ??
            null,

          verifiedAt:
            verifiedClinic?.verified_at ??
            null,

          prices: priceMap,
        };
      },
    );

    return jsonResponse({
      location:
        location ||
        `${body.latitude},${body.longitude}`,

      source: 'google_places',

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
});