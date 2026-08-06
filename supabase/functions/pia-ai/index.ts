import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

interface ChatMessage {
  sender: 'pia' | 'user';
  text: string;
}

interface PiaRequest {
  message: string;
  history?: ChatMessage[];
}

const PIA_INSTRUCTIONS = `
Du er Pia, en trygg og vennlig digital tannlegeresepsjonist for Pocket Dentist.

Oppgaver:
- Snakk naturlig på norsk.
- Hjelp pasienten med å beskrive tannproblemet.
- Spør bare ett relevant oppfølgingsspørsmål om gangen.
- Finn ut behandlingstype, alvorlighetsgrad, varighet og ønsket område.
- Ikke still spørsmål som allerede er besvart.
- Forklar at du ikke stiller diagnose.
- Ved alvorlige faresignaler skal du anbefale øyeblikkelig hjelp.

Faresignaler inkluderer:
- pustevansker
- kraftig eller ukontrollert blødning
- raskt økende hevelse i ansikt eller hals
- alvorlig skade på ansikt eller kjeve
- høy feber sammen med hevelse eller sterke smerter

Du har foreløpig ikke tilgang til ekte klinikksøk. Ikke finn på klinikknavn,
priser, åpningstider, vurderinger eller adresser. Når pasientens sted er kjent,
si at du er klar til å søke etter klinikker når klinikksøket kobles til.
`;

function createJsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    },
  });
}

export default {
  fetch: async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    return withSupabase(
      { auth: ['publishable', 'secret'] },
      async (request) => {
        try {
          const openAiApiKey = Deno.env.get('OPENAI_API_KEY');

          if (!openAiApiKey) {
            return createJsonResponse(
              { error: 'OPENAI_API_KEY is not configured.' },
              500,
            );
          }

          const body = (await request.json()) as PiaRequest;
          const message = body.message?.trim();

          if (!message) {
            return createJsonResponse(
              { error: 'A message is required.' },
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

            return createJsonResponse(
              {
                error: 'OpenAI request failed.',
                details: responseBody,
              },
              openAiResponse.status,
            );
          }

          const reply =
            responseBody.output_text ??
            responseBody.output
              ?.flatMap(
                (item: {
                  content?: Array<{ type?: string; text?: string }>;
                }) => item.content ?? [],
              )
              .find(
                (item: { type?: string; text?: string }) =>
                  item.type === 'output_text',
              )?.text;

          if (!reply) {
            return createJsonResponse(
              { error: 'Pia returned an empty response.' },
              502,
            );
          }

          return createJsonResponse({
            message: reply,
          });
        } catch (error) {
          console.error('Pia function error:', error);

          return createJsonResponse(
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
    )(req);
  },
};