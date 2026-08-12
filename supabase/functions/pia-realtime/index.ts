const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PIA_REALTIME_INSTRUCTIONS = `
Du er kun talemotoren til Pia for PocketDentist.no.

VIKTIG:
- Du skal aldri starte et svar på egen hånd.
- Pocket Dentist sin pia-ai-funksjon bestemmer nøyaktig hva Pia skal si.
- Når klienten sender response.create med en konkret tekst som skal sies, skal du bare si den teksten.
- Ikke legg til ekstra informasjon.
- Ikke endre stedsnavn, klinikknavn eller betydning.
- Standardspråket er norsk bokmål.
- Ikke bytt til engelsk, svensk eller dansk på eget initiativ.
- Bytt språk bare dersom teksten du eksplisitt blir bedt om å si faktisk er på et annet språk.
- Snakk varmt, rolig og naturlig, som en norsk tannlegeresepsjonist.
`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    if (req.method !== "POST") {
        return new Response(
            "Method not allowed",
            {
                status: 405,
                headers: corsHeaders,
            },
        );
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
            !contentType.includes(
                "application/sdp",
            ) &&
            !contentType.includes(
                "text/plain",
            )
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
                    transcription: {
                        model:
                            "gpt-4o-mini-transcribe",

                        language: "nb",

                        prompt:
                            "Norsk bokmål. Pocket Dentist. Tannlege, tannklinikk, tannverk, rotfylling, tannkrone, undersøkelse, akutt, Jessheim, Kløfta, Lillestrøm, Oslo, Gardermoen, Ullensaker.",
                    },

                    turn_detection: {
                        type: "server_vad",

                        threshold: 0.5,

                        prefix_padding_ms: 300,

                        silence_duration_ms: 700,

                        /*
                         * Realtime detects/transcribes turns,
                         * but NEVER generates its own answer.
                         */
                        create_response: false,

                        /*
                         * Keep this false for now.
                         * We don't want Realtime cancelling
                         * pia-ai-controlled speech unexpectedly.
                         */
                        interrupt_response: false,
                    },
                },

                output: {
                    voice: PIA_VOICE_ID,
                },
            },
        };

        const formData =
            new FormData();

        formData.set(
            "sdp",
            sdp,
        );

        formData.set(
            "session",
            JSON.stringify(
                sessionConfig,
            ),
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