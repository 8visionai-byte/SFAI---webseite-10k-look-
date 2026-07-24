import { createHash } from 'node:crypto';
import {
  getElevenLabsAgentPrompt,
  getRemoteKnowledgeText,
  NAV_MAP,
  NAV_SECTIONS,
} from './_knowledge.mjs';

/*
 * Sesja głosowa ElevenLabs Agents (platforma Agents / Conversational AI).
 *
 * Flow:
 *  1. Klient robi POST (opcjonalnie z kontekstem wznowienia po przejściu na podstronę).
 *  2. Endpoint SAM dba o trzy zasoby na platformie ElevenLabs (self-provisioning):
 *     a) narzędzie navigate_to w /v1/convai/tools (inline prompt.tools jest
 *        DEPRECATED w OpenAPI — "use tool_ids instead"), podpinane do agenta
 *        przez prompt.tool_ids;
 *     b) dokument natywnej knowledge base (treść z KNOWLEDGE_DOC_URL) —
 *        re-upload tylko przy zmianie hasha treści, nazwa dokumentu zawiera
 *        hash, stare wersje są sprzątane po aktualizacji agenta;
 *     c) agenta — szuka po nazwie, tworzy gdy brak, PATCH gdy hash konfiguracji
 *        w repo (prompt + tool_ids + knowledge base + turn-taking) się zmienił.
 *  3. Zwraca token sesji WebRTC (fallback: signed URL WebSocket) + lekkie
 *     overrides (first message, język, głos) + dynamic variable resume_note.
 *     Pełny prompt NIE jest już wysyłany per sesja (dieta promptu = szybszy
 *     start odpowiedzi). Klucz API NIGDY nie trafia do przeglądarki.
 *
 * Latencja (skarga: 5-6 s ciszy przed odpowiedzią) — co ją zbijało:
 *  - LLM bez "myślenia": GPT-4.1 Mini (klasa non-reasoning; docs: "Keep
 *    reasoning effort set to None to avoid the agent thinking too long"),
 *    a dla modeli z env: thinking_budget 0 (Gemini) / reasoning_effort (GPT-5).
 *  - turn-taking: turn_eagerness "eager" + speculative_turn (generacja rusza
 *    w ciszy, zanim model tury potwierdzi koniec wypowiedzi użytkownika).
 *  - baza wiedzy jako dokument usage_mode "prompt" (bez RAG: RAG wg docs
 *    dodaje ~250 ms na odpowiedź; doc i tak jest mały, limit 24k znaków).
 *
 * Źródła (dokumentacja ElevenLabs, sprawdzone 2026-07-24):
 *  - https://api.elevenlabs.io/openapi.json (enum LLM, LLMReasoningEffort,
 *    TurnConfig/TurnEagerness, deprecacja prompt.tools, ToolRequestModel,
 *    KnowledgeBaseLocator/DocumentUsageModeEnum, endpointy /v1/convai/tools
 *    i /v1/convai/knowledge-base/text)
 *  - https://elevenlabs.io/docs/eleven-agents/customization/llm.md
 *  - https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow.md
 *  - https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag.md
 *  - https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools
 */

const API_BASE = 'https://api.elevenlabs.io';
const AGENT_NAME = process.env.ELEVENLABS_AGENT_NAME?.trim() || 'SFAI Voice Agent';
// Voice ID to identyfikator publiczny (nie sekret). Env ELEVENLABS_VOICE_ID nadpisuje.
const DEFAULT_VOICE_ID = 'Bz1e1clEKwgN71Vx7cxj';
/*
 * LLM: decyzja właściciela — mózg od OpenAI. Z enum LLM w OpenAPI ElevenLabs
 * wybrany gpt-4.1-mini: klasa non-reasoning (zero tokenów "myślenia" = zero
 * sekund ciszy), najlepszy kompromis TTFT vs jakość tool-callingu i polszczyzny
 * w rodzinie mini/nano (gpt-4.1-nano jest szybszy, ale słabiej trzyma reguły
 * rozróżniania chatbot/voicebot w NAV_PROMPT; modele gpt-5* to klasa reasoning
 * — nawet na minimalnym wysiłku potrafią dołożyć ciszę). Env ELEVENLABS_LLM
 * nadal nadpisuje; dla modeli z "myśleniem" patrz buildReasoningControls().
 */
const DEFAULT_LLM = 'gpt-4.1-mini';
// TTS: eleven_flash_v2_5 = niska latencja + polski (eleven_flash_v2 jest tylko EN).
const DEFAULT_TTS_MODEL = 'eleven_flash_v2_5';
const FIRST_MESSAGE = 'Cześć, jestem głosową asystentką SimpleFast AI. W czym mogę pomóc Twojej firmie?';
// Wartość domyślna dynamic variable {{resume_note}} (sekcja "Kontekst
// wznowienia" w promptcie agenta), gdy sesja NIE jest wznowieniem.
const RESUME_NOTE_DEFAULT = 'Brak. To początek zupełnie nowej rozmowy.';
const TOOL_NAME = 'navigate_to';
// Prefiks nazw dokumentów natywnej knowledge base; po nim hash treści.
const KB_DOC_PREFIX = 'SFAI Wiedza ';
const UPSTREAM_TIMEOUT_MS = 12_000;
// Twardy limit łączny na provisioning+token w jednym requeście (patrz raceDeadline).
const GLOBAL_DEADLINE_MS = 40_000;

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

const sha12 = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 12);

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

/*
 * Wyłączanie "myślenia" modeli, żeby żaden wybór z env nie wprowadzał sekund
 * ciszy przed odpowiedzią (docs LLM: reasoning effort "None" zalecane dla
 * rozmów głosowych; thinking_budget "Use 0 to turn off"):
 *  - gemini*  -> thinking_budget: 0 (Gemini 2.5+ myśli domyślnie!),
 *  - gpt-5 / gpt-5-mini / gpt-5-nano (+ warianty datowane 2025-08-07)
 *    -> reasoning_effort: 'minimal' (najniższy poziom wspierany przez bazową
 *    rodzinę gpt-5), nowsze gpt-5.x -> reasoning_effort: 'none',
 *  - gpt-4.1 i gpt-4o (wszystkie warianty) -> nic (klasa non-reasoning),
 *  - claude -> nic (extended thinking domyślnie wyłączone).
 * Enum LLMReasoningEffort: none/minimal/low/medium/high/xhigh/max.
 */
const GPT5_BASE_FAMILY = new Set([
  'gpt-5', 'gpt-5-mini', 'gpt-5-nano',
  'gpt-5-2025-08-07', 'gpt-5-mini-2025-08-07', 'gpt-5-nano-2025-08-07',
]);
const buildReasoningControls = (llm) => {
  const id = String(llm).toLowerCase();
  if (id.startsWith('gemini')) return { thinking_budget: 0 };
  if (GPT5_BASE_FAMILY.has(id)) return { reasoning_effort: 'minimal' };
  if (id.startsWith('gpt-5')) return { reasoning_effort: 'none' };
  return {};
};

// Definicja client toola navigate_to (wykonywany w przeglądarce przez SDK).
// Od 2026 narzędzia żyją w /v1/convai/tools (ToolRequestModel.tool_config),
// a agent dostaje tylko referencję w prompt.tool_ids.
const buildNavigateToolConfig = () => ({
  type: 'client',
  name: TOOL_NAME,
  description: 'Pokaż użytkownikowi sekcję serwisu SimpleFast.ai na bieżącej stronie (mode "show", rozmowa trwa dalej) albo otwórz podstronę (mode "open"). Używaj zawsze, gdy rozmówca prosi, aby coś pokazać, gdzieś go przenieść albo pyta, gdzie coś znaleźć. Sekcję dobieraj wyłącznie według mapy sekcji z promptu; przy niejednoznacznej prośbie najpierw dopytaj.',
  expects_response: true,
  response_timeout_secs: 10,
  // Użytkownik może wejść botowi w słowo także w trakcie wywołania narzędzia.
  disable_interruptions: false,
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

/*
 * Porównanie definicji narzędzia: API /v1/convai/tools NIE ma pola na tagi
 * ani metadane (ToolRequestModel = tool_config + response_mocks), więc nie da
 * się trzymać hasha jak na agencie. Porównujemy pole po polu: każda wartość
 * z definicji w repo musi być identyczna w konfiguracji zdalnej; NADMIAROWE
 * pola zdalne (defaulty dopisywane przez platformę) ignorujemy.
 */
const isSubsetDeep = (desired, remote) => {
  if (desired === remote) return true;
  if (Array.isArray(desired)) {
    return Array.isArray(remote)
      && desired.length === remote.length
      && desired.every((item, index) => isSubsetDeep(item, remote[index]));
  }
  if (desired && typeof desired === 'object') {
    if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return false;
    return Object.keys(desired).every((key) => isSubsetDeep(desired[key], remote[key]));
  }
  return false;
};

// Cache na czas życia instancji funkcji (deploy = nowa instancja = ponowna
// weryfikacja). Osobne in-flight promisy: dwa równoległe requesty na tej samej
// instancji nie mogą prowizjonować osobno.
let toolCache = { id: '', configHash: '' };
let toolInFlight = null;

const ensureTool = (apiKey) => {
  if (!toolInFlight) {
    toolInFlight = doEnsureTool(apiKey).finally(() => { toolInFlight = null; });
  }
  return toolInFlight;
};

const doEnsureTool = async (apiKey) => {
  const desired = buildNavigateToolConfig();
  const configHash = sha12(desired);
  if (toolCache.id && toolCache.configHash === configHash) return toolCache.id;

  const listing = await elevenFetch(apiKey, `/v1/convai/tools?search=${encodeURIComponent(TOOL_NAME)}&page_size=100`);
  const matches = (listing?.tools || []).filter((tool) => tool?.tool_config?.name === TOOL_NAME);

  if (!matches.length) {
    const created = await elevenFetch(apiKey, '/v1/convai/tools', {
      method: 'POST',
      body: { tool_config: desired },
    });
    if (!created?.id) throw new Error('ElevenLabs create tool: brak id w odpowiedzi.');
    // Wyścig dwóch zimnych startów: obie instancje zbiegają do jednego
    // zwycięzcy (najmniejsze id), przegrany kasuje własny duplikat.
    try {
      const recheck = await elevenFetch(apiKey, `/v1/convai/tools?search=${encodeURIComponent(TOOL_NAME)}&page_size=100`);
      const twins = (recheck?.tools || []).filter((tool) => tool?.tool_config?.name === TOOL_NAME);
      const canonical = twins.sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
      if (canonical?.id && canonical.id !== created.id) {
        await elevenFetch(apiKey, `/v1/convai/tools/${created.id}`, { method: 'DELETE' }).catch(() => {});
        toolCache = { id: canonical.id, configHash: '' };
        console.log('ElevenLabs tool duplicate resolved ->', canonical.id);
        return canonical.id;
      }
    } catch {}
    toolCache = { id: created.id, configHash };
    console.log('ElevenLabs tool created', created.id, configHash);
    return created.id;
  }

  const existing = matches.sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  if (!isSubsetDeep(desired, existing.tool_config)) {
    await elevenFetch(apiKey, `/v1/convai/tools/${existing.id}`, {
      method: 'PATCH',
      body: { tool_config: desired },
    });
    console.log('ElevenLabs tool updated', existing.id, configHash);
  }
  toolCache = { id: existing.id, configHash };
  return existing.id;
};

/*
 * Natywna knowledge base: treść z KNOWLEDGE_DOC_URL (Google Doc) trafia na
 * platformę jako dokument tekstowy POST /v1/convai/knowledge-base/text.
 * Nazwa dokumentu zawiera hash treści -> re-upload TYLKO gdy treść się
 * zmieniła (i dedupe między instancjami: najpierw szukamy po nazwie).
 * usage_mode "prompt" = całość wstrzykiwana do promptu po stronie ElevenLabs,
 * ZERO narzutu RAG (wg docs RAG dodaje ~250 ms; nasz doc ma limit 24k znaków,
 * więc RAG jest zbędny). Stare wersje dokumentu sprzątamy PO aktualizacji
 * agenta (cleanupStaleKbDocs), żeby konto nie puchło.
 */
let kbCache = { id: '', name: '', textHash: '' };
let kbInFlight = null;
let staleKbIds = [];

const kbLocatorFrom = (cache) => (cache.id
  ? { type: 'text', name: cache.name, id: cache.id, usage_mode: 'prompt' }
  : null);

const ensureKnowledgeDoc = (apiKey) => {
  if (!kbInFlight) {
    kbInFlight = doEnsureKnowledgeDoc(apiKey).finally(() => { kbInFlight = null; });
  }
  return kbInFlight;
};

const doEnsureKnowledgeDoc = async (apiKey) => {
  let text = '';
  try {
    text = await getRemoteKnowledgeText();
  } catch {
    text = '';
  }
  if (!text) {
    // Brak KNOWLEDGE_DOC_URL albo trwała awaria pobierania: jedziemy na
    // ostatnim dobrym dokumencie (jeśli był), inaczej bez natywnej KB
    // (agent ma wiedzę wbudowaną w prompt).
    if (!kbCache.id && process.env.KNOWLEDGE_DOC_URL?.trim()) {
      // Zimny start + chwilowa awaria pobrania Doca: przejmij AKTUALNY dokument
      // z platformy, zamiast PATCH-ować produkcyjnego agenta z pustą bazą wiedzy.
      try {
        const listing = await elevenFetch(apiKey, `/v1/convai/knowledge-base?search=${encodeURIComponent(KB_DOC_PREFIX.trim())}&page_size=100`);
        const existing = (listing?.documents || []).find((doc) => String(doc?.name || '').startsWith(KB_DOC_PREFIX) && doc?.id);
        if (existing) {
          // Pusty textHash => pierwsza UDANA próba pobrania zweryfikuje treść na nowo.
          kbCache = { id: existing.id, name: String(existing.name), textHash: '' };
          console.log('ElevenLabs KB adopted from platform', existing.id);
        }
      } catch {}
    }
    return kbLocatorFrom(kbCache);
  }

  const textHash = sha12(text);
  if (kbCache.id && kbCache.textHash === textHash) return kbLocatorFrom(kbCache);

  const name = `${KB_DOC_PREFIX}${textHash}`;
  try {
    const listing = await elevenFetch(apiKey, `/v1/convai/knowledge-base?search=${encodeURIComponent(KB_DOC_PREFIX.trim())}&page_size=100`);
    const documents = (listing?.documents || []).filter((doc) => String(doc?.name || '').startsWith(KB_DOC_PREFIX));
    let current = documents.find((doc) => doc.name === name);
    if (!current) {
      current = await elevenFetch(apiKey, '/v1/convai/knowledge-base/text', {
        method: 'POST',
        body: { text, name },
      });
      console.log('ElevenLabs KB document created', current?.id, name);
    }
    if (!current?.id) throw new Error('ElevenLabs KB: brak id dokumentu w odpowiedzi.');
    // Stare wersje do skasowania po tym, jak agent przejdzie na nową.
    staleKbIds = documents.filter((doc) => doc.id && doc.id !== current.id).map((doc) => doc.id);
    kbCache = { id: current.id, name, textHash };
  } catch (error) {
    // Awaria KB nie blokuje sesji: zostajemy przy ostatnim dobrym dokumencie.
    console.error('ElevenLabs KB provisioning failed', error?.message || error);
  }
  return kbLocatorFrom(kbCache);
};

const cleanupStaleKbDocs = async (apiKey) => {
  const ids = staleKbIds;
  staleKbIds = [];
  for (const id of ids) {
    // Bez force: jeśli inny (stary) config agenta jeszcze używa dokumentu,
    // delete się nie uda — spróbujemy przy kolejnej zmianie treści.
    await elevenFetch(apiKey, `/v1/convai/knowledge-base/${id}`, { method: 'DELETE' })
      .then(() => console.log('ElevenLabs KB stale document deleted', id))
      .catch(() => {});
  }
};

// Pełna konfiguracja agenta trzymana w repo (prompt-as-code).
const buildAgentPayload = (voiceId, llm, toolId, kbLocator) => ({
  name: AGENT_NAME,
  conversation_config: {
    agent: {
      first_message: FIRST_MESSAGE,
      language: 'pl',
      // Użytkownik może przerwać też pierwszą wypowiedź (naturalna rozmowa).
      disable_first_message_interruptions: false,
      // Domyślna wartość {{resume_note}}; sesja wznowienia nadpisuje ją przez
      // dynamicVariables w startSession (bez przesyłania całego promptu).
      dynamic_variables: {
        dynamic_variable_placeholders: { resume_note: RESUME_NOTE_DEFAULT },
      },
      prompt: {
        prompt: getElevenLabsAgentPrompt(),
        llm,
        temperature: 0.3,
        // Zero "myślenia" = zero sekund ciszy (szczegóły przy funkcji).
        ...buildReasoningControls(llm),
        // Narzędzie podpięte referencją; inline prompt.tools jest deprecated.
        tool_ids: toolId ? [toolId] : [],
        knowledge_base: kbLocator ? [kbLocator] : [],
      },
    },
    /*
     * Turn-taking pod dynamiczną rozmowę (docs conversation-flow):
     *  - turn_eagerness "eager": bot wchodzi przy najbliższej okazji
     *    (rekomendacja docs dla customer service); semantyczny VAD (default
     *    turn_v3) pilnuje, żeby nie ucinać w pół słowa,
     *  - speculative_turn: generacja odpowiedzi startuje już w ciszy, zanim
     *    model tury potwierdzi koniec wypowiedzi (mniejsze odczuwalne TTFT,
     *    minimalnie wyższy koszt LLM),
     *  - turn_timeout 6 s: szybsze ponowne zagajenie przy ciszy użytkownika,
     *  - soft_timeout 2 s: jeśli LLM wyjątkowo mieli, bot najpierw krótko
     *    potakuje zamiast milczeć.
     */
    turn: {
      turn_timeout: 6,
      turn_eagerness: 'eager',
      speculative_turn: true,
      soft_timeout_config: {
        timeout_seconds: 2,
        message: 'Mhm, już mówię.',
      },
    },
    // Jawna lista client events: gwarantuje włączone interrupcje (event
    // "interruption") i wywołania narzędzia w przeglądarce ("client_tool_call").
    conversation: {
      client_events: [
        'conversation_initiation_metadata',
        'asr_initiation_metadata',
        'ping',
        'audio',
        'interruption',
        'user_transcript',
        'agent_response',
        'agent_response_correction',
        'client_tool_call',
        'agent_tool_response',
      ],
    },
    tts: {
      model_id: DEFAULT_TTS_MODEL,
      voice_id: voiceId,
    },
  },
  platform_settings: {
    // Agent prywatny: sesję można zacząć tylko przez token/signed URL z tego endpointu.
    auth: { enable_auth: true },
    // Per sesja nadpisujemy już TYLKO lekkie pola (bez promptu — least privilege;
    // kontekst wznowienia idzie dynamic variable, nie override'em promptu).
    overrides: {
      conversation_config_override: {
        agent: {
          first_message: true,
          language: true,
        },
        tts: { voice_id: true },
      },
    },
  },
});

// Wersja konfiguracji = hash payloadu (obejmuje prompt, LLM, tool_ids,
// knowledge base i turn-taking). Zmiana w repo LUB nowy dokument KB LUB nowe
// tool_id => nowy tag => automatyczny PATCH agenta przy najbliższej sesji.
const configTagFor = (payload) => `sfai-cfg-${sha12(payload)}`;

let agentCache = { id: '', configTag: '' };
let ensureInFlight = null;

const ensureAgent = (apiKey, toolId, kbLocator) => {
  if (!ensureInFlight) {
    ensureInFlight = doEnsureAgent(apiKey, toolId, kbLocator).finally(() => { ensureInFlight = null; });
  }
  return ensureInFlight;
};

const doEnsureAgent = async (apiKey, toolId, kbLocator) => {
  const payload = buildAgentPayload(
    resolveVoiceId(),
    (process.env.ELEVENLABS_LLM || '').trim() || DEFAULT_LLM,
    toolId,
    kbLocator,
  );
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

  // Globalny deadline: odpowiedź MUSI wyjść grubo przed maxDuration 60s Vercela.
  // Przy brownoucie ElevenLabs (każdy call ~11 s pod 12-sekundowym capem) suma
  // sekwencyjnych kroków mogłaby ubić funkcję bez odpowiedzi — lepiej szybki 502
  // (klient ma fallback OpenAI). Promise.race NIE abortuje współdzielonych
  // promisów in-flight — fetche dogasną na własnych capach.
  const requestStartedAt = Date.now();
  const raceDeadline = (promise, label) => Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`elevenlabs deadline: ${label}`)),
        Math.max(1, GLOBAL_DEADLINE_MS - (Date.now() - requestStartedAt)),
      );
      timer?.unref?.();
    }),
  ]);

  // Telemetria latencji: czasy kroków (ms) w logach Vercela, bez sekretów.
  const timings = {};
  const timed = async (label, work) => {
    const startedAt = Date.now();
    try {
      return await work();
    } finally {
      timings[label] = Date.now() - startedAt;
    }
  };

  let agentId;
  const pinnedAgentId = process.env.ELEVENLABS_AGENT_ID?.trim();
  if (pinnedAgentId) {
    // Agent wskazany ręcznie: pomijamy cały provisioning (tool/KB/agent).
    agentId = pinnedAgentId;
  } else {
    try {
      const [toolId, kbLocator] = await raceDeadline(Promise.all([
        timed('ensure_tool_ms', () => ensureTool(apiKey)),
        timed('ensure_kb_ms', () => ensureKnowledgeDoc(apiKey)),
      ]), 'tool_kb');
      agentId = await raceDeadline(timed('ensure_agent_ms', () => ensureAgent(apiKey, toolId, kbLocator)), 'agent');
    } catch (error) {
      console.error('ElevenLabs provisioning failed', error?.message || error);
      return writeJson(response, 502, {
        error: 'Agent głosowy jest chwilowo niedostępny.',
        code: 'elevenlabs_provisioning_failed',
      });
    }
  }

  let connection;
  try {
    // Sprzątanie starych dokumentów KB równolegle z pobraniem tokenu
    // (agent już przełączony na nowy dokument, delete nic nie blokuje).
    [connection] = await raceDeadline(Promise.all([
      timed('session_token_ms', () => createSessionCredentials(apiKey, agentId)),
      cleanupStaleKbDocs(apiKey),
    ]), 'credentials');
  } catch (error) {
    // Agent mógł zostać ręcznie skasowany w dashboardzie ElevenLabs: 4xx przy
    // tokenie unieważnia cache, żeby następny request na tej instancji przeszedł
    // pełny listing/create zamiast wiecznie celować w nieistniejącego agenta.
    if (!pinnedAgentId && typeof error?.status === 'number' && error.status >= 400 && error.status < 500 && error.status !== 429) {
      agentCache = { id: '', configTag: '' };
    }
    console.error('ElevenLabs session credentials failed', error?.status || '', error?.message || error);
    return writeJson(response, 502, {
      error: 'Nie udało się uruchomić połączenia głosowego.',
      code: 'elevenlabs_session_failed',
    });
  }

  console.log('elevenlabs-session timings', JSON.stringify(timings));

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
    // Dieta promptu: żadnego pełnego promptu per sesja. Kontekst wznowienia
    // idzie jako dynamic variable {{resume_note}} (placeholder w promptcie
    // agenta), overrides tylko dla lekkich pól.
    ...(resumeNote ? { dynamicVariables: { resume_note: resumeNote } } : {}),
    overrides: {
      agent: {
        firstMessage,
        language: 'pl',
      },
      tts: { voiceId: resolveVoiceId() },
    },
  });
}
