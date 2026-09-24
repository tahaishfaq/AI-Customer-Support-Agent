import { formatNdjsonLine } from './ndjson.js';

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
    TURN_IN_PROGRESS: 'This message is still being answered.',
  };
  const requested = error?.details?.code || error?.code;
  const code = Object.hasOwn(known, requested) ? requested : 'CHAT_FAILED';
  return { code, message: known[code] || 'Unable to process chat. Check the conversation before trying again.', status: [400, 401, 402, 403, 404, 409, 429, 499, 502, 503, 504].includes(error?.status) ? error.status : 500 };
}

const PHASES = ['thinking', 'understanding', 'searching', 'answering'];
const PHASE_MESSAGES = {
  thinking: 'Thinking…',
  understanding: 'Checking knowledge…',
  searching: 'Checking connected tools…',
  answering: 'Writing the answer…',
};

function phaseForActivity(data) {
  if (data?.mode === 'knowledge') return 'understanding';
  if (['http', 'mcp', 'web_search', 'hybrid', 'handoff'].includes(data?.mode)) return 'searching';
  return 'thinking';
}

/**
 * Maps internal chat events (meta/tool/delta/done/error) to the NDJSON wire contract
 * (docs/features/CHAT_STREAMING_NDJSON.md). Display-only: nothing here authorizes anything.
 */
export function createWireEventMapper({ flushPadBytes = 0 } = {}) {
  let phaseIndex = -1;
  let streamed = '';
  const status = (phase, data) => {
    const index = PHASES.indexOf(phase);
    if (index <= phaseIndex) return [];
    phaseIndex = index;
    const message = phase === 'searching' && data?.mode === 'web_search' ? 'Searching the web…' : PHASE_MESSAGES[phase];
    return [{ type: 'status', status: 'processing', phase, message }];
  };
  const text = (delta, replace) => {
    streamed = replace ? delta : `${streamed}${delta}`;
    const line = { type: 'text', delta, ...(replace ? { replace: true } : {}) };
    // Draft cleared because the model chose tools: status goes back to searching.
    if (replace && !delta) {
      phaseIndex = Math.min(phaseIndex, PHASES.indexOf('understanding'));
      return [line, ...status('searching')];
    }
    return [...(delta ? status('answering') : []), line];
  };
  return function map(event) {
    const data = event?.data;
    switch (event?.type) {
      case 'start':
        return [
          { type: 'start', turnId: data?.turnId || null },
          // Padding pushes proxies (nginx, CDNs) past their buffer so the first tokens show at once.
          ...(flushPadBytes > 0 ? [{ type: 'status', phase: 'flush', pad: ' '.repeat(flushPadBytes) }] : []),
          ...status('thinking'),
        ];
      case 'meta':
        return [{ type: 'meta', ...data }];
      case 'list':
        // Chunk of a large tool list (display only); appended client-side by listId.
        return [{ type: 'list', data }];
      case 'tool':
        return [...status(phaseForActivity(data), data), { type: 'activity', data }];
      case 'delta':
        if (data?.replace) return text(String(data.text || ''), true);
        return data?.text ? text(String(data.text), false) : [];
      case 'done': {
        const result = data || {};
        const content = typeof result.message?.content === 'string' ? result.message.content : '';
        return [
          // Final persisted text wins over anything streamed (refusal, sanitize, clarify).
          // Whitespace-only differences (server trims) would just flash the bubble.
          ...(content && content.trim() !== streamed.trim() ? text(content, true) : []),
          { type: 'cards', data: {
            citations: result.message?.citations || result.citations || [],
            sources: result.message?.sources || result.sources || [],
            ...(result.usedKnowledge ? { usedKnowledge: result.usedKnowledge } : {}),
          } },
          { type: 'actions', data: {
            pendingConfirmations: result.pendingConfirmations || [],
            showHandoffButton: Boolean(result.showHandoffButton),
            handoffTriggered: Boolean(result.handoffTriggered),
            identityRefreshRequired: Boolean(result.identityRefreshRequired),
          } },
          { type: 'complete' },
          { type: 'done', body: { success: true, data: result } },
        ];
      }
      case 'error':
        return [{ type: 'error', ...safeChatStreamError(data) }];
      default:
        return [];
    }
  };
}

// Transport cancellation stops new work, not a write already dispatched.
export function createChatServerStream(execute, { signal: requestSignal, timeoutMs = 60_000, maxBufferedBytes = 1_048_576, onError, turnId = null, flushPadBytes = 2048 } = {}) {
  const abortController = new AbortController();
  const map = createWireEventMapper({ flushPadBytes });
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
    for (const line of map(event)) {
      const bytes = encoder.encode(formatNdjsonLine(line));
      if (bytes.byteLength > maxBufferedBytes || controller.desiredSize < bytes.byteLength) { abort(); return; }
      try { controller.enqueue(bytes); } catch (error) { console.warn('[chat-stream] enqueue failed:', error.message, { eventType: line.type, bytesLength: bytes.byteLength }); abort(); return; }
    }
    if (event.type === 'done' || event.type === 'error') { completed = true; close(); }
  };
  return new ReadableStream({
    start(target) {
      controller = target;
      requestSignal?.addEventListener('abort', abort, { once: true });
      if (requestSignal?.aborted) { abort(); return; }
      emit({ type: 'start', data: { turnId } });
      if (closed) return;
      timer = setTimeout(() => { emit({ type: 'error', data: { code: 'CHAT_TIMEOUT', status: 504 } }); abortController.abort(); }, timeoutMs);
      void Promise.resolve().then(() => {
        if (!closed) return execute({ emit, signal: abortController.signal });
      }).catch(error => {
        try { onError?.(error); } catch { /* Logging must not affect execution. */ }
        emit({ type: 'error', data: error });
      }).finally(() => {
        if (!closed && !completed) emit({ type: 'error', data: null });
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
