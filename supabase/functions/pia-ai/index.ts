import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

interface ChatMessage {
  sender: 'pia' | 'user';
  text: string;
}

interface PiaRequest {
  message: string;
  history?: ChatMessage[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PIA_INSTRUCTIONS = `
Du er Pia, en trygg og vennlig digital tannlegeresepsjonist for Pocket Dentist.

Oppgaver:
- Snakk naturlig på norsk.
- Hjelp pasienten med å beskrive tannproblemet.
- Spør bare ett relevant oppfølgingsspørsmål om gangen.
- Ikke spør om informasjon pasienten allerede har gitt.
- Finn ut behandlingstype, alvorlighetsgrad, varighet og ønsket område.
- Forklar tydelig at du ikke stiller en diagnose.
- Hold svarene korte og enkle.

Faresignaler inkluderer:
- pustevansker
- kraftig eller ukontrollert blødning
- raskt økende hevelse i ansikt eller hals
- alvorlig skade på ansikt eller kjeve
- høy feber sammen med hevelse eller sterke smerter

Ved faresignaler:
- anbefal øyeblikkelig hjelp
- be pasienten kontakte 113 eller legevakt
- ikke fortsett med vanlig klinikksøk

Du har foreløpig ikke tilgang til ekte klinikksøk.
Ikke finn på klinikknavn, priser, adresser, vurderinger eller åpningstider.
Når sted og behov er kjent, si at klinikksøket snart kan startes.
`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function extractReply(responseBody: {
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
      .slice(-12)
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
          max_output_tokens: 350,
        }),
      },
    );

    const responseBody = await openAiResponse.json();

    if (!openAiResponse.ok) {
      console.error('OpenAI error:', responseBody);

      return jsonResponse(
        {
          error: 'OpenAI request failed.',
        },
        openAiResponse.status,
      );
    }

    const reply = extractReply(responseBody);

    if (!reply) {
      return jsonResponse(
        {
          error: 'Pia returned an empty response.',
        },
        502,
      );
    }

    return jsonResponse({
      message: reply,
    });
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