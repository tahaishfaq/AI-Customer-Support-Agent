import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createActivityStream, activityModeForAction, activityOutcome } from '../lib/chat/activity-emitter.js';
import { executeHttpAction } from '../lib/actions/http-executor.js';
import { callMcpTool } from '../lib/mcp/client.js';

test('activity envelopes hide internal identifiers and payloads; invocations stay distinct', () => {
  const events = [];
  const emit = createActivityStream(event => events.push(event));
  const send = (id, phase) => emit({ type: 'tool', data: { kind: 'agent_activity', activityId: id, mode: 'web_search', phase, label: 'secret', args: 'secret', url: 'private' } });
  send('provider-private-id', 'running');
  send('provider-private-id', 'running');
  send('provider-private-id', 'completed');
  send('provider-second-id', 'running');
  assert.equal(events.length, 3);
  assert.deepEqual(events.map(e => e.data.sequence), [1, 2, 3]);
  assert.equal(events[0].data.activityId, events[1].data.activityId);
  assert.notEqual(events[0].data.activityId, events[2].data.activityId);
  assert.equal(new Set(events.map(e => e.data.turnId)).size, 1);
  assert.doesNotMatch(JSON.stringify(events), /secret|private|provider-/);
  send('provider-private-id', 'running');
  assert.equal(events.length, 3, 'terminal activities cannot reopen');
  assert.doesNotThrow(() => createActivityStream(() => { throw Error('closed'); })({ type: 'tool', data: { kind: 'agent_activity', activityId: 'a', mode: 'http', phase: 'running' } }));
});

test('trusted descriptors and actual outcomes override misleading names and ERROR status', () => {
  assert.equal(activityModeForAction({ name: 'mcp_search' }), 'http');
  assert.equal(activityModeForAction({ name: 'lookup', _mcp: {} }), 'mcp');
  assert.equal(activityModeForAction({ _builtin: { id: 'request_handoff' } }), 'handoff');
  assert.deepEqual(activityOutcome({ status: 'ERROR', errorCode: 'CONFIRMATION_REQUIRED' }), { phase: 'needs_confirmation' });
  assert.deepEqual(activityOutcome({ status: 'ERROR', errorCode: 'IDENTITY_REQUIRED' }), { phase: 'needs_identity' });
  assert.deepEqual(activityOutcome({ status: 'OK', idempotencyReplay: true }), { phase: 'completed', outcome: 'replayed' });
  assert.deepEqual(activityOutcome({ status: 'OK', errorCode: 'CACHE_HIT' }), { phase: 'completed', outcome: 'cache_hit' });
  assert.deepEqual(activityOutcome({ status: 'TIMEOUT' }), { phase: 'failed', outcome: 'timeout' });
  assert.deepEqual(activityOutcome({ status: 'NO_RESULT' }), { phase: 'completed', outcome: 'no_result' });
  assert.deepEqual(activityOutcome({ capabilityResult: { status: 'denied' } }), { phase: 'failed', outcome: 'denied' });
});

test('HTTP emits only after request validation and SSRF checks, immediately before dispatch', async () => {
  const original = globalThis.fetch;
  const order = [];
  globalThis.fetch = async () => { order.push('fetch'); return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }); };
  const options = { method: 'GET', urlTemplate: 'http://127.0.0.1:3000/capture', allowLocalDemo: true, retryOnce: false, onDispatch: () => order.push('running') };
  try {
    const valid = await executeHttpAction(options);
    assert.equal(valid.ok, true);
    assert.deepEqual(order, ['running', 'fetch']);
    order.length = 0;
    const invalid = await executeHttpAction({ ...options, urlTemplate: 'http://127.0.0.1:3000/{{missing}}' });
    assert.equal(invalid.ok, false);
    assert.deepEqual(order, []);
    const blocked = await executeHttpAction({ ...options, allowLocalDemo: false });
    assert.equal(blocked.ok, false);
    assert.deepEqual(order, []);
    const resilient = await executeHttpAction({ ...options, onDispatch: () => { throw Error('closed'); } });
    assert.equal(resilient.ok, true);
    assert.deepEqual(order, ['fetch']);
    order.length = 0;
    globalThis.fetch = async () => { order.push('fetch'); throw new DOMException('timed out', 'AbortError'); };
    const timeout = await executeHttpAction(options);
    assert.equal(timeout.status, 'TIMEOUT');
    assert.deepEqual(order, ['running', 'fetch']);
  } finally { globalThis.fetch = original; }
});

test('MCP emits after SSRF and cancellation checks without adding transport calls', async () => {
  const original = globalThis.fetch;
  const order = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    order.push(body.method);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [] } }), { headers: { 'content-type': 'application/json' } });
  };
  const options = { url: 'http://127.0.0.1:3000/api/demo/mcp', toolName: 'lookup', onDispatch: () => order.push('running') };
  try {
    await callMcpTool(options);
    assert.deepEqual(order, ['running', 'initialize', 'notifications/initialized', 'tools/call']);
    order.length = 0;
    await assert.rejects(callMcpTool({ ...options, url: 'http://127.0.0.1:3000/private' }));
    assert.deepEqual(order, []);
    await assert.rejects(callMcpTool({ ...options, signal: AbortSignal.abort() }));
    assert.deepEqual(order, []);
    globalThis.fetch = async () => { order.push('fetch'); throw new DOMException('timed out', 'AbortError'); };
    await assert.rejects(callMcpTool(options), { code: 'TIMEOUT' });
    assert.deepEqual(order, ['running', 'fetch']);
  } finally { globalThis.fetch = original; }
});
