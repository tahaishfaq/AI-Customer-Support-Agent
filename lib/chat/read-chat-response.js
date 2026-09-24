import { NDJSON_CONTENT_TYPE, parseNdjsonBuffer } from './ndjson.js';

const MAX_BUFFER_CHARS = 1_048_576;
const MAX_STREAM_CHARS = 4_194_304;

function streamError(event) {
  const error = new Error(event?.message || 'Unable to process chat');
  error.details = { code: event?.code || null };
  error.status = event?.status;
  return error;
}

/**
 * O3.1 — read one chat turn: NDJSON live stream (docs/features/CHAT_STREAMING_NDJSON.md)
 * or a plain JSON reply. Resolves with the final turn snapshot (`done.body.data`).
 */
export async function readChatResponse(response, handlers = {}) {
  const { signal } = handlers;
  signal?.throwIfAborted();
  if (!response.headers.get('content-type')?.includes(NDJSON_CONTENT_TYPE)) {
    const data = await response.json();
    signal?.throwIfAborted();
    if (!response.ok) {
      const error = new Error(data?.error?.message || 'Unable to process chat');
      error.status = response.status;
      error.details = data?.error?.details || {};
      throw error;
    }
    return data;
  }
  if (!response.ok || !response.body) throw new Error('Unable to open chat stream');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  let buffer = '';
  let total = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      const chunk = value ? decoder.decode(value, { stream: true }) : decoder.decode();
      total += chunk.length;
      buffer += done ? `${chunk}\n` : chunk;
      if (buffer.length > MAX_BUFFER_CHARS || total > MAX_STREAM_CHARS) throw new Error('Chat stream exceeded its size limit');
      const parsed = parseNdjsonBuffer(buffer);
      buffer = parsed.rest;
      for (const event of parsed.events) {
        if (event.type === 'done') return event.body?.data ?? null;
        if (event.type === 'error') throw streamError(event);
        dispatch(event, handlers);
      }
      if (done) throw new Error('Chat stream ended without a result');
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function dispatch(event, handlers) {
  switch (event.type) {
    case 'start': handlers.onStart?.(event); break;
    case 'meta': handlers.onMeta?.(event); break;
    case 'status': handlers.onStatus?.(event); break;
    case 'text': handlers.onText?.({ delta: String(event.delta || ''), replace: Boolean(event.replace) }); break;
    case 'activity': handlers.onActivity?.(event.data); break;
    case 'cards': handlers.onCards?.(event.data); break;
    case 'list': handlers.onList?.(event.data); break;
    case 'actions': handlers.onActions?.(event.data); break;
    case 'complete': handlers.onComplete?.(); break;
    default: break;
  }
  handlers.onEvent?.(event);
}

// One request, never an automatic retry: a disconnected write may already exist.
export async function requestChatStream(url, body, options = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(() => controller.abort(new DOMException('Chat request timed out', 'TimeoutError')), 65_000);
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    options.signal?.throwIfAborted();
    const response = await fetch(url, {
      method: 'POST', credentials: 'include', signal: controller.signal,
      headers: { Accept: `${NDJSON_CONTENT_TYPE}, application/json`, 'Content-Type': 'application/json', ...options.headers },
      body: JSON.stringify({ ...body, stream: true }),
    });
    return await readChatResponse(response, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
