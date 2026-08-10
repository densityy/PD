import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
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
    | 'request_location'
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

SPRÅK:
- Standardspråket ditt er norsk bokmål.
- Oppdag språket i pasientens nyeste meningsfulle melding.
- Svar ALLTID på samme språk som pasienten bruker i den nyeste meldingen.
- Hvis pasienten snakker eller skriver norsk, svar på norsk bokmål.
- Hvis pasienten snakker eller skriver engelsk, svar på engelsk.
- Hvis pasienten bruker et annet språk, svar på det språket så godt du kan.
- Hvis pasienten bytter språk under samtalen, bytt til samme språk.
- Ikke bytt språk på eget initiativ.
- Ikke oversett pasientens melding med mindre pasienten ber om det.
- Hvis språket er uklart eller meldingen er svært kort, behold språket som allerede brukes i samtalen.
- Hvis du fortsatt er usikker, bruk norsk bokmål.
- Klinikkdata, stedsnavn og egennavn skal beholdes korrekt selv om samtalen foregår på et annet språk.

SAMTALESTIL:
- Vær varm, naturlig, rolig og profesjonell.
- Skriv slik en ekte resepsjonist ville snakket.
- Anerkjenn kort det pasienten sier når det passer naturlig.
- Ikke gjenta spørsmål som allerede er besvart.
- Bruk informasjon fra hele samtalehistorikken.
- Still bare ett relevant oppfølgingsspørsmål om gangen når nødvendig informasjon faktisk mangler.
- Ikke still spørsmål bare fordi et felt i datastrukturen er tomt.
- Hold svarene relativt korte fordi Pia også brukes i talesamtaler.
- Unngå lange forklaringer dersom et kort svar er nok.
- Ikke overdriv eller skrem pasienten.
- Du kan forklare tannbehandling generelt, men du stiller ikke diagnose.

INFORMASJON DU SKAL FORSTÅ OG TREKKE UT:
- sted, by, område eller postnummer
- alder
- behandling eller tannproblem
- smertegrad fra 1 til 10 dersom oppgitt
- varighet dersom oppgitt
- om pasienten vil finne klinikk
- om pasienten vil sammenligne priser
- om pasienten spør om offentlig tannbehandling eller rettigheter
- om pasienten ønsker offentlige eller private klinikker

BEHANDLINGSTYPER:
- toothache: tannpine, tannverk eller vondt i en tann
- checkup: kontroll eller undersøkelse
- emergency: akutt tannlegebehov
- cosmetic: estetisk behandling eller tannbleking
- broken_tooth: knekt eller brukket tann
- wisdom_tooth: visdomstann
- root_canal: rotfylling
- cleaning: tannrens eller tannstein
- other: annet tannhelsebehov

KLINIKKSØK OG POSISJON:

- Smertegrad, varighet og alder er IKKE obligatoriske for å søke etter klinikker.
- Hvis sted og tannproblem allerede er kjent, skal manglende smertegrad IKKE hindre klinikksøk.
- Spør om smertegrad bare dersom det er nødvendig for sikkerhetsvurdering eller triage.

- Når pasienten har et konkret tannhelsebehov, men sted IKKE er kjent:
  1. sett extracted.wantsClinicSearch til false
  2. legg til "request_location" i actions
  3. IKKE legg til "search_clinics" ennå
  4. IKKE be pasienten om å si stedsnavnet muntlig
  5. si kun kort og naturlig at Pia trenger posisjonen for å finne relevante klinikker

- Når "request_location" brukes, vil Pocket Dentist-grensesnittet vise pasienten valg som:
  - "Bruk min posisjon"
  - "Skriv inn sted"
- Ikke be pasienten om å gjenta posisjonen muntlig når frontend kan hente den direkte.

- Når både sted og et konkret tannhelsebehov er kjent:
  1. sett extracted.wantsClinicSearch til true
  2. legg til "search_clinics" i actions
  3. IKKE legg til "request_location"

- Eksempel:
  Pasient: "Jeg har tannverk."
  Sted er ikke kjent.
  Da skal du legge til "request_location" i actions.
  Du kan si noe kort som at du trenger posisjonen for å finne klinikker i nærheten.
  Du skal IKKE spørre pasienten om å si hvor de befinner seg.

- Eksempel:
  Tidligere informasjon: pasienten har tannverk.
  Frontend eller tidligere samtale har gitt sted = Jessheim.
  Da skal du sette wantsClinicSearch=true og legge til "search_clinics".
  Ikke spør om smertegrad først.

- Bruk hele samtalehistorikken når du avgjør om sted og behandlingsbehov er kjent.
- Ikke mist tannproblemet fordi den nyeste meldingen bare inneholder annen informasjon.
- Ikke spør om sted på nytt dersom sted allerede finnes i samtalen eller er gitt av frontend.
- Ikke spør om lov til å søke dersom pasienten tydelig trenger eller ønsker tannlege.
- Når klinikksøk skal utføres, si naturlig og kort at du finner relevante alternativer.
- Ikke finn på klinikknavn, priser, vurderinger, adresser eller åpningstider.
- Faktiske klinikkdata skal komme fra Pocket Dentist sitt klinikksøk.

PRIS:

- Når pasienten spør om pris, billigst, rimeligst, kostnad eller sammenligning:
  - sett wantsPriceComparison til true
  - legg til "compare_prices" i actions
- Ikke finn på priser.

OFFENTLIG ELLER PRIVAT:

- Ikke avgjør endelig om noen har rett til offentlig tannbehandling uten oppdatert regelkilde.
- Når pasienten spør om offentlig tannbehandling, støtte eller rettigheter:
  - sett asksAboutPublicEligibility til true
  - legg til "check_public_eligibility" i actions
- Alder og behandling kan være relevant for denne vurderingen.
- Ikke be om alder før det faktisk er nødvendig for offentlig rettighet eller annen relevant vurdering.

FARESIGNALER:
Faresignaler inkluderer:

- pustevansker
- kraftig eller ukontrollert blødning
- raskt økende hevelse i ansikt eller hals
- alvorlig skade på ansikt eller kjeve
- høy feber sammen med hevelse eller sterke smerter

Ved faresignaler:
- emergencyWarning skal være true
- legg til "show_emergency_advice" i actions
- gi kort og tydelig råd om øyeblikkelig hjelp
- ikke bruk vanlig klinikksøk som eneste tiltak

VIKTIG:
- Du stiller ikke diagnose.
- Du erstatter ikke tannlege eller akutt helsehjelp.
- Ikke finn på medisinske fakta, klinikker, priser eller rettigheter.
- Ikke svar med informasjon som ikke er nødvendig for å hjelpe pasienten videre.
- extracted og actions skal alltid gjenspeile informasjonen fra HELE samtalen, ikke bare siste melding.
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
          'request_location',
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!openAiApiKey || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          error: 'Server credentials are not configured.',
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

    // Prevent excessively large messages from reaching OpenAI.
    if (message.length > 2000) {
      return jsonResponse(
        {
          error: 'Message is too long.',
        },
        400,
      );
    }

    // Only send a limited amount of conversation history to OpenAI.
    const history = (body.history ?? [])
      .slice(-10)
      .map((item) => ({
        role: item.sender === 'user' ? 'user' : 'assistant',
        content: item.text.slice(0, 2000),
      }));

    // Identify caller for rate limiting.
    const forwardedFor =
      request.headers.get('x-forwarded-for');

    const clientIp =
      forwardedFor?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: rateLimitResult,
      error: rateLimitError,
    } = await supabaseAdmin.rpc(
      'check_pia_rate_limit',
      {
        p_identifier: clientIp,
      },
    );

    if (rateLimitError) {
      console.error(
        'Pia rate limit check failed:',
        rateLimitError,
      );

      return jsonResponse(
        {
          error: 'Could not verify request limit.',
        },
        500,
      );
    }

    const rateLimit = rateLimitResult?.[0];

    if (!rateLimit?.allowed) {
      return jsonResponse(
        {
          error: 'Too many requests. Please try again later.',
        },
        429,
      );
    }

    // OpenAI is only called after the request passes the rate limit.
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
          max_output_tokens: 700,
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
      console.error(
        'Could not parse Pia response:',
        outputText,
        error,
      );

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