import { createHash } from 'node:crypto';
import { getVoiceInstructions } from './_knowledge.mjs';

// Sekcje serwisu dostępne dla narzędzia navigate_to. Slugi usług 1:1 z src/data/services.js.
export const NAV_SECTIONS = [
  'start',
  'uslugi',
  'architekci-wartosci-ai',
  'chatboty-ai',
  'strony-www-seo-ai',
  'voiceboty-ai',
  'agenci-ai',
  'automatyzacja-procesow',
  'opieka-ai',
  'jak-pracujemy',
  'realizacje',
  'wiedza',
  'o-nas',
  'kontakt',
];

const RATE_WINDOW_MS = 10 * 60 * 1_000;
const MAX_SESSIONS_PER_WINDOW = 6;
const sessionBuckets = new Map();

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

const consumeSessionQuota = (identifier) => {
  const now = Date.now();
  const active = (sessionBuckets.get(identifier) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (active.length >= MAX_SESSIONS_PER_WINDOW) {
    sessionBuckets.set(identifier, active);
    return Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - active[0])) / 1_000));
  }
  active.push(now);
  sessionBuckets.set(identifier, active);
  return 0;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return writeJson(response, 405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.voicebotapi || process.env.VOICEBOTAPI;
  if (!apiKey) {
    return writeJson(response, 503, {
      error: 'Agent głosowy nie został jeszcze aktywowany na serwerze.',
      code: 'agent_not_configured',
    });
  }

  const identifier = safetyIdentifier(request);
  const retryAfter = consumeSessionQuota(identifier);
  if (retryAfter) {
    response.setHeader('Retry-After', String(retryAfter));
    return writeJson(response, 429, {
      error: 'Limit prób uruchomienia rozmowy został osiągnięty. Spróbuj ponownie za kilka minut.',
      code: 'voice_rate_limited',
    });
  }

  // Defensywnie: na hostingu może wisieć stara ręczna wartość OPENAI_VOICE=marin
  // (brzmiała nie-polsko). Traktujemy ją jak przestarzałą i wymuszamy 'cedar',
  // dopóki ktoś świadomie nie ustawi innego głosu.
  let voice = (process.env.OPENAI_VOICE || '').trim();
  if (!voice || voice === 'marin') voice = 'cedar';

  const sessionConfig = {
    session: {
      type: 'realtime',
      model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
      instructions: await getVoiceInstructions(),
      output_modalities: ['audio'],
      audio: {
        output: {
          voice,
        },
      },
      tools: [
        {
          type: 'function',
          name: 'navigate_to',
          description: 'Pokaż użytkownikowi sekcję serwisu SimpleFast.ai na bieżącej stronie (mode "show", rozmowa trwa dalej) albo otwórz podstronę (mode "open"). Używaj zawsze, gdy rozmówca prosi, aby coś pokazać, gdzieś go przenieść albo pyta, gdzie coś znaleźć.',
          parameters: {
            type: 'object',
            properties: {
              section: {
                type: 'string',
                enum: NAV_SECTIONS,
                description: 'Docelowa sekcja serwisu. „start” to strona główna, „uslugi” to lista usług, pozostałe to konkretne podstrony.',
              },
              mode: {
                type: 'string',
                enum: ['show', 'open'],
                description: '„show” (domyślne) pokazuje sekcję na bieżącej stronie bez przerywania rozmowy; „open” przechodzi na osobną podstronę (tylko na wyraźną prośbę użytkownika).',
              },
            },
            required: ['section'],
          },
        },
      ],
      tool_choice: 'auto',
    },
  };

  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': identifier,
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
