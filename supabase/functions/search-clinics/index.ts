import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

interface ClinicSearchRequest {
  location: string;
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
  businessStatus?: string;
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
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
    const googlePlacesApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

    if (!googlePlacesApiKey) {
      return jsonResponse(
        {
          error: 'GOOGLE_PLACES_API_KEY is not configured.',
        },
        500,
      );
    }

    const body = (await request.json()) as ClinicSearchRequest;
    const location = normalizeLocation(body.location ?? '');

    if (!location) {
      return jsonResponse(
        {
          error: 'Location is required.',
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

    const googleResponse = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googlePlacesApiKey,
          'X-Goog-FieldMask': [
            'places.id',
            'places.displayName',
            'places.formattedAddress',
            'places.location',
            'places.rating',
            'places.userRatingCount',
            'places.googleMapsUri',
            'places.businessStatus',
          ].join(','),
        },
        body: JSON.stringify({
          textQuery: `tannlege i ${location}, Norge`,
          includedType: 'dentist',
          strictTypeFiltering: true,
          languageCode: 'nb',
          regionCode: 'NO',
          maxResultCount: maxResults,
        }),
      },
    );

    const googleData =
      (await googleResponse.json()) as GooglePlacesResponse & {
        error?: unknown;
      };

    if (!googleResponse.ok) {
      console.error('Google Places error:', googleData);

      return jsonResponse(
        {
          error: 'Clinic search failed.',
          details: googleData.error,
        },
        googleResponse.status,
      );
    }

    const clinics = (googleData.places ?? [])
      .filter(
        (place) =>
          place.id &&
          place.displayName?.text &&
          place.businessStatus !== 'CLOSED_PERMANENTLY',
      )
      .map((place) => ({
        id: place.id as string,
        name: place.displayName?.text ?? 'Ukjent tannklinikk',
        address: place.formattedAddress ?? '',
        city: location,
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
        rating: place.rating,
        reviewCount: place.userRatingCount,
        googleMapsUrl: place.googleMapsUri,
        isPartner: false,
        isVerified: false,
      }));

    return jsonResponse({
      location,
      source: 'google_places',
      clinics,
    });
  } catch (error) {
    console.error('Search clinics function error:', error);

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