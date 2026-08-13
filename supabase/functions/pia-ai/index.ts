import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
interface ChatMessage {
  sender: "pia" | "user";
  text: string;
}

interface PiaRequest {
  message: string;
  history?: ChatMessage[];
  source?: "chat" | "voice";
}

interface PiaStructuredResponse {
  message: string;
  extracted: {
    location: string | null;
    treatment:
      | "toothache"
      | "checkup"
      | "emergency"
      | "cosmetic"
      | "broken_tooth"
      | "wisdom_tooth"
      | "root_canal"
      | "cleaning"
      | "other"
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
    | "search_clinics"
    | "request_location"
    | "compare_prices"
    | "check_public_eligibility"
    | "ask_follow_up"
    | "show_emergency_advice"
    | "none"
  >;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PIA_INSTRUCTIONS = `
Du er Pia, en trygg, varm og naturlig digital tannlegeresepsjonist for Pocket Dentist.

Målet ditt er at samtalen skal føles som en ekte samtale med en dyktig resepsjonist,
ikke som et skjema eller en rigid spørsmålsliste.

SPRÅK:
- Standardspråket er norsk bokmål.
- I talesamtaler skal du IKKE bytte språk bare fordi transkripsjonen inneholder engelske ord eller ser engelsk ut.
- Fortsett på norsk bokmål med mindre pasienten eksplisitt ber deg snakke et annet språk, for eksempel "snakk engelsk" eller "speak English".
- Hvis pasienten eksplisitt ber om et annet språk, kan du bytte.
- Et stedsnavn, navn, merkenavn eller enkeltord skal aldri utløse språkbytte.
- Ikke bytt til svensk eller dansk.
- Hvis du er usikker: bruk norsk bokmål.

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

- Hovedmålet ditt er å hjelpe pasienten videre til en relevant tannklinikk når det er naturlig.
- Ikke bli værende i tilfeldig småprat eller lange generelle samtaler. Hold samtalen tannhelserelatert og fremdriftsorientert.
- Hvis pasienten beskriver et tannproblem, still maksimalt ett nødvendig og relevant oppfølgingsspørsmål om gangen. Når du har nok informasjon til å hjelpe videre, led naturlig mot klinikksøk.
- Hvis pasienten uttrykker at de trenger tannlege, klinikk, behandling, time, pris eller hjelp til å finne noen, skal dette behandles som klinikksøk-intent.
- Eksempler på klinikksøk-intent: "finn en klinikk", "finn meg en tannlege", "jeg trenger en tannlege", "tannlege nær meg", "hvor kan jeg få rotfylling", "find me a clinic", "find a dentist".
- Du skal ALDRI be pasienten gå til en annen Pocket Dentist-side eller si at de kan bruke "Finn klinikk". DU ER inngangen til klinikksøket.
- Du skal ALDRI be pasienten Google, søke på Google Maps, søke på nettet eller finne klinikker selv.
- Du skal ALDRI anbefale at pasienten bruker en ekstern søkemotor for å finne tannlege.
- Når pasienten vil finne tannlege eller klinikk, skal Pocket Dentist håndtere søket via request_location.

VIKTIG POSISJONSREGEL:
- Før ALLE klinikksøk skal frontend alltid be pasienten bekrefte posisjon.
- Selv om pasienten allerede har sagt eller skrevet et stedsnavn som Jessheim, Oslo eller Kløfta i samtalen, skal du IKKE starte klinikksøk direkte.
- Ikke stol på muntlig transkribert stedsnavn som endelig søkeposisjon.
- Når klinikksøk skal utføres:
  1. sett extracted.wantsClinicSearch til false
  2. legg til "request_location" i actions
  3. IKKE legg til "search_clinics"
  4. svar kort at Pia trenger at pasienten bekrefter posisjonen
- Frontend viser deretter:
  - "Bruk min posisjon"
  - "Skriv inn sted"
- Når pasienten velger ett av disse alternativene, utfører frontend selve klinikksøket uten at du skal spørre på nytt.
- Ikke be pasienten si posisjonen muntlig når posisjonsvelgeren kan brukes.
- Ikke anta Oslo eller noe annet sted.
- Ikke finn på klinikknavn, priser, vurderinger, adresser eller åpningstider.
- Faktiske klinikkdata skal alltid komme fra Pocket Dentist sitt klinikksøk.

SAMTALEFREMDIFT:
- Ved vanlig tannhelseprat skal du forsøke å hjelpe pasienten mot et konkret neste steg.
- Dersom pasienten har et behandlingsbehov og det ikke er behov for akuttveiledning, er et naturlig neste steg ofte å tilby å finne en klinikk.
- Ikke press pasienten, men ikke avslutt med generisk informasjon når et klinikksøk er et åpenbart nyttig neste steg.
- Hvis pasienten bare småprater om noe som ikke er relevant for tannhelse, svar kort og styr vennlig tilbake til hva Pia kan hjelpe med innen tannhelse.
- Smertegrad, varighet og alder er IKKE obligatoriske for å åpne klinikksøk.
- Spør om smertegrad bare når det faktisk er nødvendig for sikkerhetsvurdering eller triage.

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
  type: "object",
  additionalProperties: false,
  properties: {
    message: {
      type: "string",
    },
    extracted: {
      type: "object",
      additionalProperties: false,
      properties: {
        location: {
          type: ["string", "null"],
        },
        treatment: {
          type: ["string", "null"],
          enum: [
            "toothache",
            "checkup",
            "emergency",
            "cosmetic",
            "broken_tooth",
            "wisdom_tooth",
            "root_canal",
            "cleaning",
            "other",
            null,
          ],
        },
        age: {
          type: ["integer", "null"],
          minimum: 0,
          maximum: 120,
        },
        severity: {
          type: ["integer", "null"],
          minimum: 1,
          maximum: 10,
        },
        duration: {
          type: ["string", "null"],
        },
        wantsClinicSearch: {
          type: "boolean",
        },
        wantsPriceComparison: {
          type: "boolean",
        },
        asksAboutPublicEligibility: {
          type: "boolean",
        },
        wantsPublicClinics: {
          type: "boolean",
        },
        wantsPrivateClinics: {
          type: "boolean",
        },
        emergencyWarning: {
          type: "boolean",
        },
      },
      required: [
        "location",
        "treatment",
        "age",
        "severity",
        "duration",
        "wantsClinicSearch",
        "wantsPriceComparison",
        "asksAboutPublicEligibility",
        "wantsPublicClinics",
        "wantsPrivateClinics",
        "emergencyWarning",
      ],
    },
    actions: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "search_clinics",
          "request_location",
          "compare_prices",
          "check_public_eligibility",
          "ask_follow_up",
          "show_emergency_advice",
          "none",
        ],
      },
    },
  },
  required: ["message", "extracted", "actions"],
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
    .find((item) => item.type === "output_text")?.text;
}

function normalizeIntentText(value: string) {
  return value
    .toLocaleLowerCase("nb-NO")
    .replace(/[.,!?;:()[\]{}"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsClinicIntent(value: string) {
  const text = normalizeIntentText(value);

  const clinicWords = [
    "klinikk",
    "tannklinikk",
    "tannlege",
    "dentist",
    "clinic",
    "dental clinic",
  ];

  const intentWords = [
    "finn",
    "finne",
    "trenger",
    "trenge",
    "ønsker",
    "ønske",
    "vil ha",
    "hjelp meg",
    "hjelpe meg",
    "hvor",
    "nær meg",
    "find",
    "need",
    "want",
    "looking for",
    "help me",
    "where",
    "near me",
  ];

  const hasClinicWord = clinicWords.some((word) => text.includes(word));

  const hasIntentWord = intentWords.some((word) => text.includes(word));

  if (hasClinicWord && hasIntentWord) {
    return true;
  }

  const explicitPhrases = [
    "bestill time",
    "bestille time",
    "book time",
    "book appointment",
    "get an appointment",
    "where can i get",
    "hvor kan jeg få",
    "hvor kan jeg gå",
  ];

  return explicitPhrases.some((phrase) => text.includes(phrase));
}

function hasRecentClinicIntent(message: string, history: ChatMessage[]) {
  if (containsClinicIntent(message)) {
    return true;
  }

  return history
    .slice(-8)
    .filter((item) => item.sender === "user")
    .some((item) => containsClinicIntent(item.text));
}

function enforceClinicSearchFlow(
  parsed: PiaStructuredResponse,
  clinicIntent: boolean,
  source: "chat" | "voice" = "voice",
) {
  const modelIndicatesClinicIntent =
    parsed.extracted.wantsClinicSearch ||
    parsed.actions.includes("search_clinics") ||
    parsed.actions.includes("request_location");

  const shouldEnterClinicFlow = clinicIntent || modelIndicatesClinicIntent;

  if (!shouldEnterClinicFlow || parsed.extracted.emergencyWarning) {
    return parsed;
  }

  const explicitLocation = parsed.extracted.location?.trim();

  /*
   * Text chat and voice deliberately behave differently here.
   * A location typed by the user is safe to use directly. Voice calls
   * still confirm transcribed place names before searching so a speech
   * recognition mistake cannot silently send the patient to the wrong city.
   */
  const otherActions = parsed.actions.filter(
    (action) =>
      action !== "search_clinics" &&
      action !== "request_location" &&
      action !== "none",
  );

  if (source === "chat" && explicitLocation) {
    parsed.extracted.wantsClinicSearch = true;
    parsed.actions = ["search_clinics", ...otherActions];

    parsed.message = `Klart — jeg finner relevante tannklinikker i ${explicitLocation}.`;

    return parsed;
  }

  parsed.extracted.wantsClinicSearch = false;
  parsed.actions = ["request_location", ...otherActions];

  /*
   * Never allow Pia to send a patient away to Google,
   * Maps, another search engine, or another Pocket Dentist page.
   */
  parsed.message =
    "Klart — bekreft posisjonen din, så finner jeg relevante tannklinikker i nærheten.";

  return parsed;
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
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openAiApiKey || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          error: "Server credentials are not configured.",
        },
        500,
      );
    }

    const body = (await request.json()) as PiaRequest;
    const message = body.message?.trim();

    if (!message) {
      return jsonResponse(
        {
          error: "A message is required.",
        },
        400,
      );
    }

    // Prevent excessively large messages from reaching OpenAI.
    if (message.length > 2000) {
      return jsonResponse(
        {
          error: "Message is too long.",
        },
        400,
      );
    }

    // Only send a limited amount of conversation history to OpenAI.
    const history = (body.history ?? []).slice(-10).map((item) => ({
      role: item.sender === "user" ? "user" : "assistant",
      content: item.text.slice(0, 2000),
    }));

    const clinicIntent = hasRecentClinicIntent(message, body.history ?? []);

    // Identify caller for rate limiting.
    const forwardedFor = request.headers.get("x-forwarded-for");

    const clientIp =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: rateLimitResult, error: rateLimitError } =
      await supabaseAdmin.rpc("check_pia_rate_limit", {
        p_identifier: clientIp,
      });

    if (rateLimitError) {
      console.error("Pia rate limit check failed:", rateLimitError);

      return jsonResponse(
        {
          error: "Could not verify request limit.",
        },
        500,
      );
    }

    const rateLimit = rateLimitResult?.[0];

    if (!rateLimit?.allowed) {
      return jsonResponse(
        {
          error: "Too many requests. Please try again later.",
        },
        429,
      );
    }

    // OpenAI is only called after the request passes the rate limit.
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        instructions: PIA_INSTRUCTIONS,
        input: [
          ...history,
          {
            role: "user",
            content: message,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "pia_response",
            strict: true,
            schema: piaResponseSchema,
          },
        },
        reasoning: {
          effort: "low",
        },
        max_output_tokens: 700,
      }),
    });

    const responseBody = await openAiResponse.json();

    if (!openAiResponse.ok) {
      console.error("OpenAI error:", responseBody);

      return jsonResponse(
        {
          error: "OpenAI request failed.",
          details: responseBody,
        },
        openAiResponse.status,
      );
    }

    const outputText = extractOutputText(responseBody);

    if (!outputText) {
      return jsonResponse(
        {
          error: "Pia returned an empty response.",
        },
        502,
      );
    }

    let parsed: PiaStructuredResponse;

    try {
      parsed = JSON.parse(outputText) as PiaStructuredResponse;
    } catch (error) {
      console.error("Could not parse Pia response:", outputText, error);

      return jsonResponse(
        {
          error: "Pia returned invalid structured data.",
        },
        502,
      );
    }

    parsed = enforceClinicSearchFlow(
      parsed,
      clinicIntent,
      body.source === "chat" ? "chat" : "voice",
    );

    return jsonResponse(parsed);
  } catch (error) {
    console.error("Pia function error:", error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown server error.",
      },
      500,
    );
  }
});
