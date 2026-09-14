import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChatServerStream, safeChatStreamError } from '../lib/chat/server-stream.js';
import { readChatResponse, requestChatStream } from '../lib/chat/read-chat-response.js';
import { executeHttpAction } from '../lib/actions/http-executor.js';

const response = stream => new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };

test('successful lifecycle preserves progress, delta and final result; errors never leak provider internals', async () => {
  const events = [];
  const result = await readChatResponse(response(createChatServerStream(async ({ emit }) => {
    emit({ type: 'tool', data: { mode: 'http' } });
    emit({ type: 'delta', data: { text: 'Hello' } });
    emit({ type: 'done', data: { message: 'final' } });
    emit({ type: 'delta', data: { text: 'late' } });
  })), { onDelta: text => events.push(text), onTool: data => events.push(data.mode) });
  assert.deepEqual(events, ['http', 'Hello']);
  assert.deepEqual(result, { message: 'final' });
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
  const stream = createChatServerStream(context => { signal = context.signal; context.emit({ type: 'delta', data: { text: 'x'.repeat(200) } }); }, { maxBufferedBytes: 64 });
  assert.equal((await stream.getReader().read()).done, true);
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
  const content = new TextEncoder().encode('event: delta\r\ndata: {"text":"سلام"}\r\n\r\nevent: done\r\ndata: {"ok":true}\r\n\r\n');
  let text = '';
  const stream = new ReadableStream({ start(c) { for (const byte of content) c.enqueue(new Uint8Array([byte])); c.close(); } });
  assert.deepEqual(await readChatResponse(response(stream), { onDelta: value => { text += value; } }), { ok: true });
  assert.equal(text, 'سلام');
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
