

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PIA_REALTIME_INSTRUCTIONS = `
Du er Pia, den digitale tannlegeresepsjonisten for PocketDentist.no.

PERSONLIGHET
- Du er varm, rolig, empatisk, vennlig og profesjonell.
- Du snakker naturlig og kortfattet, som en ekte norsk tannlegeresepsjonist.
- Du er trygg og tydelig uten å høres robotisk, teatralsk eller kommersiell ut.
- Du stiller normalt bare ett relevant spørsmål om gangen.
- Du stiller ikke medisinske diagnoser.

SPRÅK
- Standardspråket er norsk bokmål.
- Fortsett på norsk bokmål med mindre brukeren tydelig ber om et annet språk,
  eller tydelig og vedvarende kommuniserer på et annet språk.
- Ikke bytt språk på grunn av enkeltord, navn, merkenavn, adresser,
  tannlegeuttrykk eller engelske låneord.
- Dersom skandinavisk tale er tvetydig, behold norsk bokmål.
- Ikke bytt til svensk eller dansk bare fordi talegjenkjenningen tolker
  enkelte ord som svensk eller dansk.
- Dersom du er usikker på språk, behold gjeldende språk.
- Et eksplisitt ønske som "snakk engelsk" skal bytte språk.
- Et eksplisitt ønske om å gå tilbake til norsk skal bytte tilbake til norsk.
- Behold samme Pia-personlighet uansett språk.

TALESAMTALE
- Dette er en live telefonsamtale.
- Svar naturlig og relativt kort.
- Ikke les opp lange lister dersom et kort svar er nok.
- La brukeren avbryte deg naturlig.
`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    if (req.method !== "POST") {
        return new Response("Method not allowed", {
            status: 405,
            headers: corsHeaders,
        });
    }

    try {
        const OPENAI_API_KEY =
            Deno.env.get("OPENAI_API_KEY");

        const PIA_VOICE_ID =
            Deno.env.get("PIA_VOICE_ID");

        if (!OPENAI_API_KEY) {
            console.error(
                "pia-realtime: OPENAI_API_KEY missing",
            );

            return new Response(
                "Realtime configuration unavailable.",
                {
                    status: 500,
                    headers: corsHeaders,
                },
            );
        }

        if (!PIA_VOICE_ID) {
            console.error(
                "pia-realtime: PIA_VOICE_ID missing",
            );

            return new Response(
                "Pia voice is not configured.",
                {
                    status: 500,
                    headers: corsHeaders,
                },
            );
        }

        const contentType =
            req.headers.get("content-type") ?? "";

        if (
            !contentType.includes("application/sdp") &&
            !contentType.includes("text/plain")
        ) {
            return new Response(
                "Expected SDP.",
                {
                    status: 400,
                    headers: corsHeaders,
                },
            );
        }

        const sdp = await req.text();

        if (!sdp.trim()) {
            return new Response(
                "Missing SDP.",
                {
                    status: 400,
                    headers: corsHeaders,
                },
            );
        }

        const sessionConfig = {
            type: "realtime",
            model: "gpt-realtime-2.1",

            instructions:
                PIA_REALTIME_INSTRUCTIONS,

            output_modalities: [
                "audio",
            ],

            audio: {
                input: {
                    turn_detection: {
                        type: "server_vad",

                        threshold: 0.5,

                        prefix_padding_ms: 300,

                        silence_duration_ms: 650,

                        create_response: true,

                        interrupt_response: true,
                    },
                },

                output: {
                    voice: PIA_VOICE_ID,
                },
            },
        };

        const formData = new FormData();

        formData.set(
            "sdp",
            sdp,
        );

        formData.set(
            "session",
            JSON.stringify(sessionConfig),
        );

        const openAIResponse =
            await fetch(
                "https://api.openai.com/v1/realtime/calls",
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Bearer ${OPENAI_API_KEY}`,
                    },

                    body: formData,
                },
            );

        const responseBody =
            await openAIResponse.text();

        if (!openAIResponse.ok) {
            console.error(
                "OpenAI Realtime session failed:",
                openAIResponse.status,
                responseBody,
            );

            return new Response(
                "Kunne ikke koble til Pia.",
                {
                    status: 502,

                    headers: {
                        ...corsHeaders,

                        "Content-Type":
                            "text/plain; charset=utf-8",
                    },
                },
            );
        }

        return new Response(
            responseBody,
            {
                status: 200,

                headers: {
                    ...corsHeaders,

                    "Content-Type":
                        "application/sdp",
                },
            },
        );
    } catch (error) {
        console.error(
            "pia-realtime unexpected error:",
            error,
        );

        return new Response(
            "Kunne ikke starte Pia-samtalen.",
            {
                status: 500,

                headers: {
                    ...corsHeaders,

                    "Content-Type":
                        "text/plain; charset=utf-8",
                },
            },
        );
    }
});