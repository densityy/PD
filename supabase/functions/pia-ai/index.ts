import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

interface ChatMessage {
  sender: 'pia' | 'user';
  text: string;
}

interface PiaRequest {
  message: string;
  history?: ChatMessage[];
}

interface PiaStructuredResponse {
  message: string;
  extracted: {
    location: string | null;
    treatment:
    | 'toothache'
    | 'checkup'
    | 'emergency'
    | 'cosmetic'
    | 'broken_tooth'
    | 'wisdom_tooth'
    | 'root_canal'
    | 'cleaning'
    | 'other'
    | null;
    age: number | null;
    severity: number | null;
    duration: string | null;
    wantsClinicSearch: boolean;
    wantsPriceComparison: boolean;
    asksAboutPublicEligibility: boolean;
    wantsPublicClinics: boolean;
    wantsPrivateClinics: boolean;
    emergencyWarning: boolean;
  };
  actions: Array<
    | 'search_clinics'
    | 'compare_prices'
    | 'check_public_eligibility'
    | 'ask_follow_up'
    | 'show_emergency_advice'
    | 'none'
  >;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PIA_INSTRUCTIONS = `
Du er Pia, en trygg, varm og naturlig digital tannlegeresepsjonist for Pocket Dentist.

Målet ditt er at samtalen skal føles som en ekte samtale med en dyktig resepsjonist,
ikke som et skjema eller en rigid spørsmålsliste.

Samtalestil:
- Svar naturlig på norsk.
- Anerkjenn det pasienten sier.
- Ikke gjenta spørsmål som allerede er besvart.
- Bruk informasjon fra hele samtalen.
- Spør bare ett relevant oppfølgingsspørsmål når informasjon faktisk mangler.
- Hold svarene korte, rolige og tydelige.
- Ikke overdriv eller skrem pasienten.
- Du kan forklare tannbehandling generelt, men du stiller ikke diagnose.

Du skal trekke ut informasjon fra pasientens melding:
- sted, by, område eller postnummer
- alder
- behandling eller problem
- smertegrad fra 1 til 10 dersom oppgitt
- varighet dersom oppgitt
- om pasienten vil finne klinikk
- om pasienten vil sammenligne priser
- om pasienten spør om offentlig tannbehandling eller rettigheter
- om pasienten ønsker offentlige eller private klinikker

Behandlingstyper:
- toothache: tannpine eller tannverk
- checkup: kontroll eller undersøkelse
- emergency: akutt behov
- cosmetic: estetisk behandling eller tannbleking
- broken_tooth: knekt eller brukket tann
- wisdom_tooth: visdomstann
- root_canal: rotfylling
- cleaning: tannrens eller tannstein
- other: annet tannhelsebehov

Viktig om fakta:
- Ikke finn på klinikknavn, priser, vurderinger, adresser eller åpningstider.
- Ikke avgjør endelig om noen har rett til offentlig tannbehandling.
- Når pasienten spør om offentlig rettighet, sett handlingen
  check_public_eligibility slik at Pocket Dentist kan bruke en oppdatert regelkilde.
- Når sted og behandlingsbehov er kjent, kan du sette search_clinics.
- Når pasienten ber om billigst, pris eller sammenligning, sett compare_prices.

Faresignaler:
- pustevansker
- kraftig eller ukontrollert blødning
- raskt økende hevelse i ansikt eller hals
- alvorlig skade på ansikt eller kjeve
- høy feber sammen med hevelse eller sterke smerter

Ved faresignaler:
- emergencyWarning skal være true
- legg til show_emergency_advice
- anbefal øyeblikkelig hjelp, 113 eller legevakt
- ikke anbefal vanlig klinikksøk som eneste tiltak

Når nok informasjon finnes:
- Når pasienten oppgir både sted og et konkret tannhelsebehov, skal du normalt sette
  wantsClinicSearch til true og legge til search_clinics.
- Ikke spør om lov til å søke når pasienten allerede sier at de trenger eller ønsker
  å finne en tannlege.
- Når pasienten spør hva noe koster, ber om pris, billigst eller sammenligning,
  skal wantsPriceComparison være true og compare_prices legges til.
- Ikke still enda et skjema-spørsmål.
- Si naturlig at du kan finne relevante alternativer.
`;

const piaResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    message: {
      type: 'string',
    },
    extracted: {
      type: 'object',
      additionalProperties: false,
      properties: {
        location: {
          type: ['string', 'null'],
        },
        treatment: {
          type: ['string', 'null'],
          enum: [
            'toothache',
            'checkup',
            'emergency',
            'cosmetic',
            'broken_tooth',
            'wisdom_tooth',
            'root_canal',
            'cleaning',
            'other',
            null,
          ],
        },
        age: {
          type: ['integer', 'null'],
          minimum: 0,
          maximum: 120,
        },
        severity: {
          type: ['integer', 'null'],
          minimum: 1,
          maximum: 10,
        },
        duration: {
          type: ['string', 'null'],
        },
        wantsClinicSearch: {
          type: 'boolean',
        },
        wantsPriceComparison: {
          type: 'boolean',
        },
        asksAboutPublicEligibility: {
          type: 'boolean',
        },
        wantsPublicClinics: {
          type: 'boolean',
        },
        wantsPrivateClinics: {
          type: 'boolean',
        },
        emergencyWarning: {
          type: 'boolean',
        },
      },
      required: [
        'location',
        'treatment',
        'age',
        'severity',
        'duration',
        'wantsClinicSearch',
        'wantsPriceComparison',
        'asksAboutPublicEligibility',
        'wantsPublicClinics',
        'wantsPrivateClinics',
        'emergencyWarning',
      ],
    },
    actions: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'search_clinics',
          'compare_prices',
          'check_public_eligibility',
          'ask_follow_up',
          'show_emergency_advice',
          'none',
        ],
      },
    },
  },
  required: ['message', 'extracted', 'actions'],
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
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAiApiKey) {
      return jsonResponse(
        {
          error: 'OPENAI_API_KEY is not configured.',
        },
        500,
      );
    }

    const body = (await request.json()) as PiaRequest;
    const message = body.message?.trim();

    if (!message) {
      return jsonResponse(
        {
          error: 'A message is required.',
        },
        400,
      );
    }

    const history = (body.history ?? [])
      .slice(-16)
      .map((item) => ({
        role: item.sender === 'user' ? 'user' : 'assistant',
        content: item.text,
      }));

    const openAiResponse = await fetch(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          instructions: PIA_INSTRUCTIONS,
          input: [
            ...history,
            {
              role: 'user',
              content: message,
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'pia_response',
              strict: true,
              schema: piaResponseSchema,
            },
          },
          reasoning: {
            effort: 'low',
          },
          max_output_tokens: 4000,
        }),
      },
    );

    const responseBody = await openAiResponse.json();

    if (!openAiResponse.ok) {
      console.error('OpenAI error:', responseBody);

      return jsonResponse(
        {
          error: 'OpenAI request failed.',
          details: responseBody,
        },
        openAiResponse.status,
      );
    }

    const outputText = extractOutputText(responseBody);

    if (!outputText) {
      return jsonResponse(
        {
          error: 'Pia returned an empty response.',
        },
        502,
      );
    }

    let parsed: PiaStructuredResponse;

    try {
      parsed = JSON.parse(outputText) as PiaStructuredResponse;
    } catch (error) {
      console.error('Could not parse Pia response:', outputText, error);

      return jsonResponse(
        {
          error: 'Pia returned invalid structured data.',
        },
        502,
      );
    }

    return jsonResponse(parsed);
  } catch (error) {
    console.error('Pia function error:', error);

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