import { createHash } from 'node:crypto';
import {
  getElevenLabsAgentPrompt,
  getElevenLabsSessionPrompt,
  NAV_MAP,
  NAV_SECTIONS,
} from './_knowledge.mjs';

/*
 * Sesja głosowa ElevenLabs Agents (platforma Agents / Conversational AI).
 *
 * Flow:
 *  1. Klient robi POST (opcjonalnie z kontekstem wznowienia po przejściu na podstronę).
 *  2. Endpoint SAM dba o agenta na platformie ElevenLabs (self-provisioning):
 *     szuka po nazwie, tworzy gdy brak, aktualizuje gdy konfiguracja w repo
 *     jest nowsza (hash konfiguracji w tagu agenta). Każda zmiana promptu
 *     lub narzędzia w repo propaguje się sama, zero ręcznej roboty w dashboardzie.
 *  3. Zwraca token sesji WebRTC (fallback: signed URL WebSocket) + overrides
 *     sesyjne (pełny prompt z edytowalną bazą wiedzy z KNOWLEDGE_DOC_URL,
 *     first message, głos). Klucz API NIGDY nie trafia do przeglądarki.
 *
 * Źródła (dokumentacja ElevenLabs, stan 2026-07):
 *  - https://elevenlabs.io/docs/eleven-agents/api-reference/agents/create
 *  - https://elevenlabs.io/docs/eleven-agents/api-reference/agents/list
 *  - https://elevenlabs.io/docs/eleven-agents/api-reference/agents/update
 *  - https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-signed-url
 *  - https://elevenlabs.io/docs/eleven-agents/libraries/java-script (token WebRTC)
 *  - https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools
 *  - https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides
 */

const API_BASE = 'https://api.elevenlabs.io';
const AGENT_NAME = process.env.ELEVENLABS_AGENT_NAME?.trim() || 'SFAI Voice Agent';
// Voice ID to identyfikator publiczny (nie sekret). Env ELEVENLABS_VOICE_ID nadpisuje.
const DEFAULT_VOICE_ID = 'Bz1e1clEKwgN71Vx7cxj';
// LLM: docs client-tools rekomendują m.in. Gemini 2.5 Flash do tool-callingu
// (szybki i tani); enum modeli w API create-agent. Env ELEVENLABS_LLM nadpisuje.
const DEFAULT_LLM = 'gemini-2.5-flash';
// TTS: eleven_flash_v2_5 = niska latencja + polski (eleven_flash_v2 jest tylko EN).
const DEFAULT_TTS_MODEL = 'eleven_flash_v2_5';
const FIRST_MESSAGE = 'Cześć, jestem głosową asystentką SimpleFast AI. W czym mogę pomóc Twojej firmie?';
const UPSTREAM_TIMEOUT_MS = 12_000;

const RATE_WINDOW_MS = 10 * 60 * 1_000;
const MAX_SESSIONS_PER_WINDOW = 6;
const sessionBuckets = new Map();

// Klucz wg ustaleń: na Vercelu zmienna nazywa się dokładnie `Elevenlabs`.
// Wartości klucza nigdzie nie logujemy ani nie zwracamy.
const readApiKey = () => (
  process.env.ELEVENLABS_API_KEY
  || process.env.Elevenlabs
  || process.env.ELEVENLABS
  || process.env.elevenlabs
  || ''
).trim();

const resolveVoiceId = () => (process.env.ELEVENLABS_VOICE_ID || '').trim() || DEFAULT_VOICE_ID;

const writeJson = (response, status, body) => {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
};

const clientIdentifier = (request) => {
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

const elevenFetch = async (apiKey, path, { method = 'GET', body } = {}) => {
  const upstream = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'xi-api-key': apiKey,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    // Log bez klucza i bez pełnych payloadów; wystarczy do diagnozy.
    console.error('ElevenLabs API error', method, path.split('?')[0], upstream.status, JSON.stringify(data)?.slice(0, 500));
    const error = new Error(`ElevenLabs ${method} ${path.split('?')[0]} -> HTTP ${upstream.status}`);
    error.status = upstream.status;
    throw error;
  }
  return data;
};

// Definicja client toola navigate_to (wykonywany w przeglądarce przez SDK).
// Schemat wg docs client-tools: type "client" + parameters (JSON-schema z enum).
const buildNavigateTool = () => ({
  type: 'client',
  name: 'navigate_to',
  description: 'Pokaż użytkownikowi sekcję serwisu SimpleFast.ai na bieżącej stronie (mode "show", rozmowa trwa dalej) albo otwórz podstronę (mode "open"). Używaj zawsze, gdy rozmówca prosi, aby coś pokazać, gdzieś go przenieść albo pyta, gdzie coś znaleźć. Sekcję dobieraj wyłącznie według mapy sekcji z promptu; przy niejednoznacznej prośbie najpierw dopytaj.',
  expects_response: true,
  response_timeout_secs: 10,
  parameters: {
    type: 'object',
    description: 'Cel nawigacji po serwisie SimpleFast.ai.',
    required: ['section'],
    properties: {
      section: {
        type: 'string',
        enum: NAV_SECTIONS,
        description: 'Docelowa sekcja serwisu, dokładnie jedna z mapy sekcji w promptcie. "start" to strona główna, "uslugi" to lista usług, pozostałe to konkretne podstrony.',
      },
      mode: {
        type: 'string',
        enum: ['show', 'open'],
        description: '"show" (domyślne) pokazuje sekcję na bieżącej stronie bez przerywania rozmowy; "open" przechodzi na osobną podstronę (tylko na wyraźną prośbę i zawsze po wypowiedzeniu zdania zapowiedzi).',
      },
    },
  },
});

// Pełna konfiguracja agenta trzymana w repo (prompt-as-code).
const buildAgentPayload = (voiceId, llm) => ({
  name: AGENT_NAME,
  conversation_config: {
    agent: {
      first_message: FIRST_MESSAGE,
      language: 'pl',
      prompt: {
        prompt: getElevenLabsAgentPrompt(),
        llm,
        temperature: 0.3,
        tools: [buildNavigateTool()],
      },
    },
    tts: {
      model_id: DEFAULT_TTS_MODEL,
      voice_id: voiceId,
    },
  },
  platform_settings: {
    // Agent prywatny: sesję można zacząć tylko przez token/signed URL z tego endpointu.
    auth: { enable_auth: true },
    // Pola nadpisywane per sesja (prompt z bazą wiedzy, first message, głos).
    overrides: {
      conversation_config_override: {
        agent: {
          first_message: true,
          language: true,
          prompt: { prompt: true },
        },
        tts: { voice_id: true },
      },
    },
  },
});

// Wersja konfiguracji = hash payloadu. Zmiana promptu/mapy/narzędzia w repo
// => nowy tag => automatyczny PATCH agenta przy najbliższej sesji.
const configTagFor = (payload) => `sfai-cfg-${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12)}`;

// Cache na czas życia instancji funkcji: po jednej weryfikacji nie odpytujemy
// ElevenLabs o listę agentów przy każdej sesji. Deploy = nowa instancja = ponowna weryfikacja.
let agentCache = { id: '', configTag: '' };
// Dwa równoległe requesty na tej samej instancji nie mogą prowizjonować osobno.
let ensureInFlight = null;

const ensureAgent = (apiKey) => {
  const pinnedAgentId = process.env.ELEVENLABS_AGENT_ID?.trim();
  if (pinnedAgentId) return Promise.resolve(pinnedAgentId); // agent wskazany ręcznie: pomijamy provisioning
  if (!ensureInFlight) {
    ensureInFlight = doEnsureAgent(apiKey).finally(() => { ensureInFlight = null; });
  }
  return ensureInFlight;
};

const doEnsureAgent = async (apiKey) => {
  const payload = buildAgentPayload(resolveVoiceId(), (process.env.ELEVENLABS_LLM || '').trim() || DEFAULT_LLM);
  const configTag = configTagFor(payload);
  if (agentCache.id && agentCache.configTag === configTag) return agentCache.id;

  const listing = await elevenFetch(apiKey, `/v1/convai/agents?search=${encodeURIComponent(AGENT_NAME)}&page_size=100`);
  const existing = (listing?.agents || []).find((agent) => agent?.name === AGENT_NAME);

  if (!existing) {
    const created = await elevenFetch(apiKey, '/v1/convai/agents/create', {
      method: 'POST',
      body: { ...payload, tags: ['sfai-www', configTag] },
    });
    if (!created?.agent_id) throw new Error('ElevenLabs create agent: brak agent_id w odpowiedzi.');
    // Wyścig dwóch zimnych startów (obie instancje tworzą agenta naraz):
    // obie zbiegają do tego samego zwycięzcy (najstarszy), przegrany kasuje
    // własny duplikat. Pusty configTag wymusi weryfikację configu zwycięzcy.
    try {
      const recheck = await elevenFetch(apiKey, `/v1/convai/agents?search=${encodeURIComponent(AGENT_NAME)}&page_size=100`);
      const twins = (recheck?.agents || []).filter((agent) => agent?.name === AGENT_NAME);
      const canonical = twins.sort((a, b) =>
        ((a.created_at_unix_secs ?? 0) - (b.created_at_unix_secs ?? 0)) || String(a.agent_id).localeCompare(String(b.agent_id))
      )[0];
      if (canonical?.agent_id && canonical.agent_id !== created.agent_id) {
        await elevenFetch(apiKey, `/v1/convai/agents/${created.agent_id}`, { method: 'DELETE' }).catch(() => {});
        agentCache = { id: canonical.agent_id, configTag: '' };
        console.log('ElevenLabs agent duplicate resolved ->', canonical.agent_id);
        return canonical.agent_id;
      }
    } catch {}
    agentCache = { id: created.agent_id, configTag };
    console.log('ElevenLabs agent created', created.agent_id, configTag);
    return created.agent_id;
  }

  if (!(existing.tags || []).includes(configTag)) {
    await elevenFetch(apiKey, `/v1/convai/agents/${existing.agent_id}`, {
      method: 'PATCH',
      body: { ...payload, tags: ['sfai-www', configTag] },
    });
    console.log('ElevenLabs agent updated', existing.agent_id, configTag);
  }
  agentCache = { id: existing.agent_id, configTag };
  return existing.agent_id;
};

// Preferujemy WebRTC (token); przy niepowodzeniu signed URL (WebSocket).
const createSessionCredentials = async (apiKey, agentId) => {
  try {
    const tokenData = await elevenFetch(apiKey, `/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`);
    if (tokenData?.token) return { conversationToken: tokenData.token };
  } catch (error) {
    console.error('ElevenLabs WebRTC token failed, falling back to signed URL', error?.status || error?.message);
  }
  const signed = await elevenFetch(apiKey, `/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`);
  if (!signed?.signed_url) throw new Error('ElevenLabs: brak signed_url w odpowiedzi.');
  return { signedUrl: signed.signed_url };
};

// Kontekst wznowienia: klient podaje tylko ścieżkę docelową; etykietę bierzemy
// z NAV_MAP po stronie serwera (żadny tekst z przeglądarki nie trafia do promptu).
const resolveResume = (rawResume) => {
  const target = String(rawResume?.target || '').trim();
  if (!target) return null;
  const entry = NAV_MAP.find((section) => section.path === target);
  if (!entry) return null;
  return entry;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return writeJson(response, 405, { error: 'Method not allowed.' });
  }

  const apiKey = readApiKey();
  if (!apiKey) {
    return writeJson(response, 503, {
      error: 'Agent głosowy ElevenLabs nie został jeszcze aktywowany na serwerze.',
      code: 'elevenlabs_not_configured',
    });
  }

  const retryAfter = consumeSessionQuota(clientIdentifier(request));
  if (retryAfter) {
    response.setHeader('Retry-After', String(retryAfter));
    return writeJson(response, 429, {
      error: 'Limit prób uruchomienia rozmowy został osiągnięty. Spróbuj ponownie za kilka minut.',
      code: 'voice_rate_limited',
    });
  }

  let agentId;
  try {
    agentId = await ensureAgent(apiKey);
  } catch (error) {
    console.error('ElevenLabs provisioning failed', error?.message || error);
    return writeJson(response, 502, {
      error: 'Agent głosowy jest chwilowo niedostępny.',
      code: 'elevenlabs_provisioning_failed',
    });
  }

  let connection;
  try {
    connection = await createSessionCredentials(apiKey, agentId);
  } catch (error) {
    console.error('ElevenLabs session credentials failed', error?.message || error);
    return writeJson(response, 502, {
      error: 'Nie udało się uruchomić połączenia głosowego.',
      code: 'elevenlabs_session_failed',
    });
  }

  const resume = resolveResume(request.body?.resume);
  const resumeNote = resume
    ? `Użytkownik w trakcie rozmowy głosowej przeszedł właśnie na podstronę ${resume.path} serwisu (${resume.label}; ${resume.about}). Nawiąż do tematu i płynnie kontynuuj rozmowę. Nie przedstawiaj się od nowa, nie witaj się od zera i pod żadnym pozorem nie mów, że rozmowa została przerwana lub zakończona.`
    : '';
  const firstMessage = resume
    ? `Jesteśmy na miejscu, przed Tobą ${resume.label}. O czym chcesz posłuchać?`
    : FIRST_MESSAGE;

  return writeJson(response, 200, {
    provider: 'elevenlabs',
    connection,
    overrides: {
      agent: {
        prompt: { prompt: await getElevenLabsSessionPrompt(resumeNote) },
        firstMessage,
        language: 'pl',
      },
      tts: { voiceId: resolveVoiceId() },
    },
  });
}
