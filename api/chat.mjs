import { createHash } from 'node:crypto';
import { getChatInstructions } from './_knowledge.mjs';

const MAX_MESSAGES = 14;
const MAX_MESSAGE_LENGTH = 4_000;
const RATE_WINDOW_MS = 10 * 60 * 1_000;
const MAX_CHAT_REQUESTS_PER_WINDOW = 30;
const chatBuckets = new Map();

const safetyIdentifier = (request) => {
  const forwarded = request.headers['x-forwarded-for'];
  const address = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || request.socket?.remoteAddress || 'anonymous').split(',')[0];
  return createHash('sha256').update(`sfai:${address}`).digest('hex');
};

const consumeChatQuota = (identifier) => {
  const now = Date.now();
  const active = (chatBuckets.get(identifier) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (active.length >= MAX_CHAT_REQUESTS_PER_WINDOW) {
    chatBuckets.set(identifier, active);
    return Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - active[0])) / 1_000));
  }
  active.push(now);
  chatBuckets.set(identifier, active);
  return 0;
};

const cleanMessages = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-MAX_MESSAGES)
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
    .map((message) => ({
      role: message.role,
      content: String(message.content ?? '').trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .filter((message) => message.content.length > 0);
};

const writeJson = (response, status, body) => {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return writeJson(response, 405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.voicebotapi || process.env.VOICEBOTAPI;
  if (!apiKey) {
    return writeJson(response, 503, {
      error: 'Agent nie został jeszcze aktywowany na serwerze.',
      code: 'agent_not_configured',
    });
  }

  const identifier = safetyIdentifier(request);
  const retryAfter = consumeChatQuota(identifier);
  if (retryAfter) {
    response.setHeader('Retry-After', String(retryAfter));
    return writeJson(response, 429, {
      error: 'Limit zapytań został osiągnięty. Spróbuj ponownie za kilka minut.',
      code: 'chat_rate_limited',
    });
  }

  const messages = cleanMessages(request.body?.messages);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return writeJson(response, 400, { error: 'Brakuje pytania użytkownika.' });
  }

  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID?.trim();
  const payload = {
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-5.6-sol',
    instructions: await getChatInstructions(),
    input: messages,
    max_output_tokens: 900,
    store: false,
    stream: true,
  };

  if (vectorStoreId) {
    payload.tools = [{
      type: 'file_search',
      vector_store_ids: [vectorStoreId],
      max_num_results: 5,
    }];
  }

  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': identifier,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return writeJson(response, 502, { error: 'Nie udało się połączyć z usługą AI.' });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('OpenAI Responses error', upstream.status, detail.slice(0, 800));
    return writeJson(response, 502, { error: 'Agent chwilowo nie może odpowiedzieć.' });
  }

  response.status(200);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      response.write(Buffer.from(value));
    }
  } catch (error) {
    console.error('Streaming error', error);
  } finally {
    response.end();
  }
}
