const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
    // IMPORTANT: answer CORS immediately
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    try {
        const OPENAI_API_KEY =
            Deno.env.get("OPENAI_API_KEY");

        if (!OPENAI_API_KEY) {
            return json(
                {
                    error: "OPENAI_API_KEY is missing.",
                },
                500,
            );
        }

        const contentType =
            req.headers.get("content-type") ?? "";

        // -----------------------------------
        // TRANSCRIBE AUDIO
        // -----------------------------------
        if (
            contentType.includes(
                "multipart/form-data",
            )
        ) {
            const incoming =
                await req.formData();

            const action =
                incoming.get("action");

            const audio =
                incoming.get("audio");

            if (
                action !== "transcribe" ||
                !(audio instanceof File)
            ) {
                return json(
                    {
                        error:
                            "Invalid transcription request.",
                    },
                    400,
                );
            }

            const openAIForm =
                new FormData();

            openAIForm.append(
                "file",
                audio,
            );

            openAIForm.append(
                "model",
                "gpt-4o-mini-transcribe",
            );

            openAIForm.append(
                "prompt",
                "This is a conversation with Pia, a multilingual dental receptionist. Norwegian Bokmål is the default, but the patient may speak another language. Transcribe the language actually spoken."
            );

            const response =
                await fetch(
                    "https://api.openai.com/v1/audio/transcriptions",
                    {
                        method: "POST",

                        headers: {
                            Authorization:
                                `Bearer ${OPENAI_API_KEY}`,
                        },

                        body: openAIForm,
                    },
                );

            if (!response.ok) {
                const details =
                    await response.text();

                console.error(
                    "Transcription error:",
                    response.status,
                    details,
                );

                return json(
                    {
                        error:
                            "Transcription failed.",
                        details,
                    },
                    500,
                );
            }

            const result =
                await response.json();

            return json({
                text:
                    typeof result.text ===
                        "string"
                        ? result.text.trim()
                        : "",
            });
        }

        // -----------------------------------
        // TEXT TO SPEECH
        // -----------------------------------
        if (
            contentType.includes(
                "application/json",
            )
        ) {
            const body =
                await req.json();

            if (
                body?.action !== "speak"
            ) {
                return json(
                    {
                        error:
                            "Invalid speech request.",
                    },
                    400,
                );
            }

            const text =
                typeof body.text ===
                    "string"
                    ? body.text.trim()
                    : "";

            if (!text) {
                return json(
                    {
                        error:
                            "Text is required.",
                    },
                    400,
                );
            }

            const controller =
                new AbortController();

            const timeout =
                setTimeout(() => {
                    controller.abort();
                }, 30000);

            try {
                const response =
                    await fetch(
                        "https://api.openai.com/v1/audio/speech",
                        {
                            method: "POST",

                            signal:
                                controller.signal,

                            headers: {
                                Authorization:
                                    `Bearer ${OPENAI_API_KEY}`,

                                "Content-Type":
                                    "application/json",
                            },

                            body: JSON.stringify({
                                model:
                                    "gpt-4o-mini-tts",

                                voice: "coral",

                                input:
                                    text.slice(
                                        0,
                                        3000,
                                    ),

                                instructions: `
Speak naturally in the same language as the input text.

If the text is Norwegian:
- Speak Norwegian Bokmål.
- Use a neutral standard Norwegian pronunciation.
- Prefer a clear, neutral Eastern Norwegian / Oslo-area speaking style.
- Do not switch into Nynorsk or regional dialects.
- Do not use forms such as "kva", "eg", "ikkje", or other dialect/Nynorsk forms unless they are actually present in the user's language.

You are Pia, a warm, calm young adult dental receptionist.

Sound conversational and human.
Do not sound like an announcer, narrator, customer-service bot, or text-to-speech system.
Use natural pitch changes and small pauses.
Keep a relaxed speaking rhythm.
Do not exaggerate pronunciation.
When someone is worried or in pain, sound calm and attentive.
`,
                                response_format:
                                    "mp3",
                            }),
                        },
                    );

                if (!response.ok) {
                    const details =
                        await response.text();

                    console.error(
                        "TTS error:",
                        response.status,
                        details,
                    );

                    return json(
                        {
                            error:
                                "Speech generation failed.",
                            details,
                        },
                        500,
                    );
                }

                const audio =
                    await response.arrayBuffer();

                return new Response(
                    audio,
                    {
                        status: 200,

                        headers: {
                            ...corsHeaders,
                            "Content-Type":
                                "audio/mpeg",

                            "Cache-Control":
                                "no-store",
                        },
                    },
                );
            } finally {
                clearTimeout(
                    timeout,
                );
            }
        }

        return json(
            {
                error:
                    "Unsupported content type.",
            },
            400,
        );
    } catch (error) {
        console.error(
            "pia-voice error:",
            error,
        );

        return json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            500,
        );
    }
});

function json(
    data: unknown,
    status = 200,
) {
    return new Response(
        JSON.stringify(data),
        {
            status,

            headers: {
                ...corsHeaders,

                "Content-Type":
                    "application/json; charset=utf-8",
            },
        },
    );
}