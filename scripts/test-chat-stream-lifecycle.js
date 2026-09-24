import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChatServerStream, safeChatStreamError } from '../lib/chat/server-stream.js';
import { readChatResponse, requestChatStream } from '../lib/chat/read-chat-response.js';
import { executeHttpAction } from '../lib/actions/http-executor.js';
import { closeStreamingMarkdown } from '../lib/chat/stream-markdown.js';

const response = stream => new Response(stream, { headers: { 'content-type': 'application/x-ndjson' } });
const lines = async stream => (await new Response(stream).text()).trim().split('\n').map(line => JSON.parse(line));
const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };

test('successful lifecycle preserves progress, delta and final result; errors never leak provider internals', async () => {
  const events = [];
  const result = await readChatResponse(response(createChatServerStream(async ({ emit }) => {
    emit({ type: 'tool', data: { mode: 'http' } });
    emit({ type: 'delta', data: { text: 'Hello' } });
    emit({ type: 'done', data: { message: { content: 'Hello' } } });
    emit({ type: 'delta', data: { text: 'late' } });
  })), { onText: ({ delta }) => events.push(delta), onActivity: data => events.push(data.mode) });
  assert.deepEqual(events, ['http', 'Hello']);
  assert.deepEqual(result, { message: { content: 'Hello' } });
  const error = Object.assign(new Error('provider token SECRET'), { code: 'SECRET_CODE' });
  assert.doesNotMatch(JSON.stringify(safeChatStreamError(error)), /SECRET|provider token/);
  await assert.rejects(readChatResponse(response(createChatServerStream(() => { throw error; }))), /Unable to process chat/);
  await assert.rejects(readChatResponse(response(createChatServerStream(({ emit }) => {
    emit({ type: 'error', data: { message: 'provider token SECRET', code: 'SECRET_CODE' } });
  }))), /Unable to process chat/);
});

test('cancel before dispatch does no work; cancel during dispatched work never retries or crashes late emissions', async () => {
  let calls = 0;
  const controller = new AbortController(); controller.abort();
  const early = createChatServerStream(() => { calls++; }, { signal: controller.signal });
  assert.equal((await early.getReader().read()).done, true);
  assert.equal(calls, 0);
  const started = gate(); const complete = gate(); const persisted = gate();
  const stream = createChatServerStream(async ({ emit, signal }) => {
    calls++; started.resolve();
    await complete.promise;
    assert.equal(signal.aborted, true);
    assert.doesNotThrow(() => emit({ type: 'done', data: { ok: true } }));
    persisted.resolve();
  });
  await started.promise;
  await stream.cancel();
  complete.resolve(); await persisted.promise;
  assert.equal(calls, 1);
});

test('timeout, backpressure and missing done close safely', async () => {
  const finish = gate();
  await assert.rejects(readChatResponse(response(createChatServerStream(() => finish.promise, { timeoutMs: 5 }))), /timed out/);
  finish.resolve();
  let signal;
  const stream = createChatServerStream(context => { signal = context.signal; context.emit({ type: 'delta', data: { text: 'x'.repeat(400) } }); }, { maxBufferedBytes: 256, flushPadBytes: 0 });
  const reader = stream.getReader();
  while (!(await reader.read()).done) { /* drain start/status preamble */ }
  assert.equal(signal.aborted, true);
  await assert.rejects(readChatResponse(response(new ReadableStream({ start(c) { c.close(); } }))), /without a result/);
});

test('client abort cancels a pending reader, releases lock and rejects without retry', async () => {
  let cancelled = 0;
  const controller = new AbortController();
  const stream = new ReadableStream({ cancel() { cancelled++; } });
  const promise = readChatResponse(response(stream), { signal: controller.signal });
  controller.abort();
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(cancelled, 1);
  assert.equal(stream.locked, false);
});

test('client bounds unterminated events and handles split CRLF plus UTF8', async () => {
  await assert.rejects(readChatResponse(response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('x'.repeat(1_048_577))); } }))), /size limit/);
  const content = new TextEncoder().encode('{"type":"text","delta":"سلام"}\r\n{"type":"done","body":{"success":true,"data":{"ok":true}}}\r\n');
  let text = '';
  const stream = new ReadableStream({ start(c) { for (const byte of content) c.enqueue(new Uint8Array([byte])); c.close(); } });
  assert.deepEqual(await readChatResponse(response(stream), { onText: ({ delta }) => { text += delta; } }), { ok: true });
  assert.equal(text, 'سلام');
});

test('NDJSON wire order: start → status → text → cards → actions → complete → done; status never regresses', async () => {
  const events = await lines(createChatServerStream(async ({ emit }) => {
    emit({ type: 'meta', data: { conversationId: 'c1' } });
    emit({ type: 'tool', data: { kind: 'agent_activity', mode: 'knowledge' } });
    emit({ type: 'tool', data: { kind: 'agent_activity', mode: 'web_search' } });
    emit({ type: 'tool', data: { kind: 'agent_activity', mode: 'preparation' } });
    emit({ type: 'delta', data: { text: 'Hi' } });
    emit({ type: 'delta', data: { text: ' there' } });
    emit({ type: 'done', data: { message: { content: 'Hi there', citations: [{ url: 'https://example.com' }] }, pendingConfirmations: [{ id: 'p1' }] } });
  }, { turnId: 'turn-1' }));
  const flush = events.filter(event => event.phase === 'flush');
  assert.equal(flush.length, 1, 'one anti-buffering pad line');
  assert.ok(flush[0].pad.length >= 2048);
  assert.equal(events.indexOf(flush[0]), 1, 'pad follows start');
  events.splice(1, 1);
  assert.deepEqual(events.map(event => event.type), ['start', 'status', 'meta', 'status', 'activity', 'status', 'activity', 'activity', 'status', 'text', 'text', 'cards', 'actions', 'complete', 'done']);
  assert.equal(events[0].turnId, 'turn-1');
  assert.deepEqual(events.filter(event => event.type === 'status').map(event => event.phase), ['thinking', 'understanding', 'searching', 'answering']);
  assert.equal(events.find(event => event.phase === 'searching').message, 'Searching the web…');
  assert.deepEqual(events.find(event => event.type === 'cards').data.citations, [{ url: 'https://example.com' }]);
  assert.deepEqual(events.find(event => event.type === 'actions').data.pendingConfirmations, [{ id: 'p1' }]);
  assert.equal(events.at(-1).body.success, true);
  assert.ok(!events.some(event => event.replace), 'matching final text needs no replace');
});

test('cleared draft moves status back to searching; whitespace-only final differences do not replace', async () => {
  const events = await lines(createChatServerStream(async ({ emit }) => {
    emit({ type: 'delta', data: { text: 'Let me look' } });
    emit({ type: 'delta', data: { text: '', replace: true } });
    emit({ type: 'tool', data: { kind: 'agent_activity', mode: 'http' } });
    emit({ type: 'delta', data: { text: 'Answer\n' } });
    emit({ type: 'done', data: { message: { content: 'Answer' } } });
  }, { flushPadBytes: 0 }));
  assert.deepEqual(events.filter(event => event.type === 'status').map(event => event.phase), ['thinking', 'answering', 'searching', 'answering']);
  assert.equal(events.filter(event => event.replace).length, 1, 'only the draft clear, no final flash');
});

test('replace clears a tool-round draft and final persisted text overrides streamed text', async () => {
  const events = await lines(createChatServerStream(async ({ emit }) => {
    emit({ type: 'delta', data: { text: 'Let me check' } });
    emit({ type: 'delta', data: { text: '', replace: true } });
    emit({ type: 'delta', data: { text: 'Draft' } });
    emit({ type: 'done', data: { message: { content: 'Final answer' } } });
  }));
  const texts = events.filter(event => event.type === 'text');
  assert.deepEqual(texts, [
    { type: 'text', delta: 'Let me check' },
    { type: 'text', delta: '', replace: true },
    { type: 'text', delta: 'Draft' },
    { type: 'text', delta: 'Final answer', replace: true },
  ]);
  let bubble = '';
  const result = await readChatResponse(response(createChatServerStream(async ({ emit }) => {
    emit({ type: 'delta', data: { text: 'Let me check' } });
    emit({ type: 'delta', data: { text: '', replace: true } });
    emit({ type: 'delta', data: { text: 'Answer' } });
    emit({ type: 'done', data: { message: { content: 'Answer' } } });
  })), { onText: ({ delta, replace }) => { bubble = replace ? delta : bubble + delta; } });
  assert.equal(bubble, 'Answer');
  assert.deepEqual(result, { message: { content: 'Answer' } });
});

test('orchestrator loop never fake-chunks finished text', async () => {
  const { readFileSync } = await import('node:fs');
  const loop = readFileSync(new URL('../lib/orchestrator/loop.js', import.meta.url), 'utf8');
  assert.doesNotMatch(loop, /emitTextAsDeltas|DELTA_CHUNK/);
});

test('TURN_IN_PROGRESS is a safe 409 stream error and only blocks a live run owned by another request', async () => {
  assert.deepEqual(safeChatStreamError({ status: 409, details: { code: 'TURN_IN_PROGRESS' } }).code, 'TURN_IN_PROGRESS');
  await assert.rejects(readChatResponse(response(createChatServerStream(() => {
    throw Object.assign(new Error('x'), { status: 409, details: { code: 'TURN_IN_PROGRESS' } });
  }))), error => error.details.code === 'TURN_IN_PROGRESS' && error.status === 409);
  const { isTurnRunInFlightElsewhere } = await import('../lib/services/turn-run-state.js');
  const now = Date.now();
  const run = { requestId: 'first', status: 'RUNNING', lastHeartbeatAt: new Date(now - 1_000) };
  assert.equal(isTurnRunInFlightElsewhere(run, 'second', now), true);
  assert.equal(isTurnRunInFlightElsewhere(run, 'first', now), false);
  assert.equal(isTurnRunInFlightElsewhere({ ...run, status: 'COMPLETED' }, 'second', now), false);
  assert.equal(isTurnRunInFlightElsewhere({ ...run, lastHeartbeatAt: new Date(now - 120_000) }, 'second', now), false);
});

test('resume transport preserves confirmation/capability/identity with one request and JSON fallback', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.equal(body.stream, true);
      assert.equal(body.resumeAfterConfirmationId, 'confirmation');
      assert.equal(body.message, undefined);
      assert.equal(body.userSession.subject, 'visitor');
      assert.equal(options.headers['x-aide-conversation-access-token'], 'fixture-capability');
      return Response.json({ ok: true });
    };
    const result = await requestChatStream('/fixture', { conversationId: 'conversation', resumeAfterConfirmationId: 'confirmation', userSession: { subject: 'visitor' } }, { headers: { 'x-aide-conversation-access-token': 'fixture-capability' } });
    assert.deepEqual(result, { ok: true }); assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('HTTP cancellation blocks undispatched work but does not interrupt or replay a dispatched write', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  const controller = new AbortController();
  const options = { method: 'POST', riskLevel: 'WRITE', urlTemplate: 'http://127.0.0.1:3000/capture', allowLocalDemo: true, dispatchSignal: controller.signal };
  try {
    globalThis.fetch = async () => { calls++; controller.abort(); return Response.json({ ok: true }); };
    assert.equal((await executeHttpAction(options)).ok, true);
    assert.equal(calls, 1);
    await assert.rejects(executeHttpAction(options), { name: 'AbortError' });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('partial markdown is closed for live rendering', () => {
  assert.equal(closeStreamingMarkdown('The status is **DRA'), 'The status is **DRA**');
  assert.equal(closeStreamingMarkdown('Run `npm'), 'Run `npm`');
  assert.equal(closeStreamingMarkdown('```js\nconst a = 1'), '```js\nconst a = 1\n```');
  assert.equal(closeStreamingMarkdown('See [docs](https://exa'), 'See docs');
  assert.equal(closeStreamingMarkdown('**done** text'), '**done** text');
  assert.equal(closeStreamingMarkdown('```\n**x\n```\nok'), '```\n**x\n```\nok');
});

test('list chunks stream as their own events between activity and the final answer', async () => {
  const events = await lines(createChatServerStream(async ({ emit }) => {
    emit({ type: 'tool', data: { kind: 'agent_activity', mode: 'mcp' } });
    emit({ type: 'list', data: { listId: 'c1', title: 'Repositories', items: [{ title: 'a/b' }], total: 2, done: false } });
    emit({ type: 'list', data: { listId: 'c1', items: [{ title: 'a/c' }], total: 2, done: true } });
    emit({ type: 'delta', data: { text: 'You have 2 repositories.' } });
    emit({ type: 'done', data: { message: { content: 'You have 2 repositories.' } } });
  }, { flushPadBytes: 0 }));
  const lists = events.filter(event => event.type === 'list');
  assert.equal(lists.length, 2);
  assert.equal(lists[0].data.title, 'Repositories');
  assert.ok(events.indexOf(lists[1]) < events.findIndex(event => event.type === 'text'));
  const received = [];
  await readChatResponse(response(createChatServerStream(async ({ emit }) => {
    emit({ type: 'list', data: { listId: 'x', items: [{ title: 'one' }], done: true } });
    emit({ type: 'done', data: { ok: true } });
  })), { onList: chunk => received.push(chunk.items[0].title) });
  assert.deepEqual(received, ['one']);
});
