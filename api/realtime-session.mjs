import { createHash } from 'node:crypto';
import { VOICE_INSTRUCTIONS } from './_knowledge.mjs';

const writeJson = (response, status, body) => {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
};

const safetyIdentifier = (request) => {
  const forwarded = request.headers['x-forwarded-for'];
  const address = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || request.socket?.remoteAddress || 'anonymous').split(',')[0];
  return createHash('sha256').update(`sfai:${address}`).digest('hex');
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return writeJson(response, 405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return writeJson(response, 503, {
      error: 'Agent głosowy nie został jeszcze aktywowany na serwerze.',
      code: 'agent_not_configured',
    });
  }

  const sessionConfig = {
    session: {
      type: 'realtime',
      model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
      instructions: VOICE_INSTRUCTIONS,
      output_modalities: ['audio'],
      audio: {
        output: {
          voice: process.env.OPENAI_VOICE || 'marin',
        },
      },
    },
  };

  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': safetyIdentifier(request),
      },
      body: JSON.stringify(sessionConfig),
    });
  } catch {
    return writeJson(response, 502, { error: 'Nie udało się uruchomić połączenia głosowego.' });
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok || !data?.value) {
    console.error('OpenAI Realtime token error', upstream.status, data);
    return writeJson(response, 502, { error: 'Agent głosowy jest chwilowo niedostępny.' });
  }

  return writeJson(response, 200, data);
}
