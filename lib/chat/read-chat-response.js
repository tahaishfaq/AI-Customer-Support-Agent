import { parseSseBuffer } from './sse.js';

const MAX_BUFFER_CHARS = 1_048_576;
const MAX_STREAM_CHARS = 4_194_304;

export async function readChatResponse(response, { signal, onDelta, onTool, onEvent } = {}) {
  signal?.throwIfAborted();
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
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
      buffer += chunk;
      if (buffer.length > MAX_BUFFER_CHARS || total > MAX_STREAM_CHARS) throw new Error('Chat stream exceeded its size limit');
      const parsed = parseSseBuffer(buffer.replace(/\r\n/g, '\n'));
      buffer = parsed.rest;
      for (const event of parsed.events) {
        if (event.type === 'done') return event.data;
        if (event.type === 'error') {
          const error = new Error(event.data?.message || 'Unable to process chat');
          error.details = { code: event.data?.code || null };
          error.status = event.data?.status;
          throw error;
        }
        if (event.type === 'delta') onDelta?.(event.data?.text || '');
        else if (event.type === 'tool') onTool?.(event.data);
        onEvent?.(event);
      }
      if (done) throw new Error('Chat stream ended without a result');
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
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
      headers: { Accept: 'text/event-stream, application/json', 'Content-Type': 'application/json', ...options.headers },
      body: JSON.stringify({ ...body, stream: true }),
    });
    return await readChatResponse(response, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
