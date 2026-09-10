import { formatSseEvent } from './sse.js';

export function safeChatStreamError(error) {
  const known = {
    CONFIRMATION_NOT_APPROVED: 'Confirmation is unavailable or has already been used.',
    CONFIRMATION_EXPIRED: 'Confirmation expired. Request a new confirmation.',
    IDENTITY_EXPIRED: 'Please sign in again.',
    IDENTITY_INVALID: 'Please verify your identity again.',
    IDENTITY_REQUIRED: 'Please sign in to continue.',
    conversation_limit_reached: 'Monthly conversation limit reached.',
    ABORTED: 'Stopped waiting for this response.',
    CHAT_TIMEOUT: 'The response timed out. Check the conversation before trying again.',
  };
  const requested = error?.details?.code || error?.code;
  const code = Object.hasOwn(known, requested) ? requested : 'CHAT_FAILED';
  return { code, message: known[code] || 'Unable to process chat. Check the conversation before trying again.', status: [400, 401, 402, 403, 404, 429, 499, 502, 503, 504].includes(error?.status) ? error.status : 500 };
}

// Transport cancellation stops new work, not a write already dispatched.
export function createChatServerStream(execute, { signal: requestSignal, timeoutMs = 60_000, maxBufferedBytes = 1_048_576, onError } = {}) {
  const abortController = new AbortController();
  let closed = false;
  let controller;
  let timer;
  let completed = false;
  const cleanup = () => { clearTimeout(timer); requestSignal?.removeEventListener('abort', abort); };
  const close = () => {
    if (closed) return;
    closed = true;
    cleanup();
    try { controller.close(); } catch { /* A reader may already have cancelled. */ }
  };
  const abort = () => { abortController.abort(); close(); };
  const encoder = new TextEncoder();
  const emit = event => {
    if (closed || completed) return;
    const data = event.type === 'error' ? safeChatStreamError(event.data) : event.data;
    const bytes = encoder.encode(formatSseEvent(event.type, data));
    if (bytes.byteLength > maxBufferedBytes || controller.desiredSize < bytes.byteLength) { abort(); return; }
    try { controller.enqueue(bytes); } catch { abort(); return; }
    if (event.type === 'done' || event.type === 'error') { completed = true; close(); }
  };
  return new ReadableStream({
    start(target) {
      controller = target;
      requestSignal?.addEventListener('abort', abort, { once: true });
      if (requestSignal?.aborted) { abort(); return; }
      timer = setTimeout(() => { emit({ type: 'error', data: safeChatStreamError({ code: 'CHAT_TIMEOUT', status: 504 }) }); abortController.abort(); }, timeoutMs);
      void Promise.resolve().then(() => {
        if (!closed) return execute({ emit, signal: abortController.signal });
      }).catch(error => {
        try { onError?.(error); } catch { /* Logging must not affect execution. */ }
        emit({ type: 'error', data: safeChatStreamError(error) });
      }).finally(() => {
        if (!closed && !completed) emit({ type: 'error', data: safeChatStreamError(null) });
        close();
      });
    },
    cancel() {
      closed = true;
      cleanup();
      abortController.abort();
    },
  }, new ByteLengthQueuingStrategy({ highWaterMark: maxBufferedBytes }));
}
