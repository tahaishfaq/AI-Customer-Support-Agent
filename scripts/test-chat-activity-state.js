import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeActivityEvent, createActivityState, reduceActivityEvent, closeActivityState, activityLabel, MAX_ACTIVITIES_PER_TURN } from '../lib/chat/activity-state.js';

const event = (overrides = {}) => ({ kind: 'agent_activity', turnId: 'turn-1', activityId: 'action-1', sequence: 1, mode: 'http', phase: 'selected', ...overrides });

test('only allowlisted fields and states enter display state', () => {
  const safe = normalizeActivityEvent(event({ label: 'secret instructions', args: { secret: 'sensitive' }, url: 'private', token: 'secret' }));
  assert.deepEqual(safe, event());
  for (const invalid of [{ phase: 'approve_write' }, { mode: 'arbitrary' }, { outcome: 'secret' }, { turnId: '../path' }, { sequence: Infinity }, { sequence: -1 }, { sequence: 1.5 }]) {
    assert.equal(normalizeActivityEvent(event(invalid)), null);
  }
});

test('turn boundaries, duplicate delivery and terminal states reject stale updates', () => {
  let state = createActivityState('turn-1');
  assert.equal(reduceActivityEvent(state, event({ turnId: 'old-turn' })), state);
  state = reduceActivityEvent(state, event());
  assert.equal(reduceActivityEvent(state, event()), state);
  state = reduceActivityEvent(state, event({ sequence: 3, phase: 'running' }));
  assert.equal(reduceActivityEvent(state, event({ sequence: 2, phase: 'validating' })), state);
  assert.equal(reduceActivityEvent(state, event({ sequence: 4, phase: 'selected' })), state);
  assert.equal(reduceActivityEvent(state, event({ sequence: 4, mode: 'mcp', phase: 'running' })), state);
  state = reduceActivityEvent(state, event({ sequence: 5, phase: 'completed' }));
  assert.equal(reduceActivityEvent(state, event({ sequence: 6, phase: 'running' })), state);
  state = closeActivityState(state);
  assert.equal(reduceActivityEvent(state, event({ activityId: 'late' })), state);
});

test('independent invocations and bounded state do not overwrite each other', () => {
  let state = createActivityState('turn-1');
  for (let i = 0; i < MAX_ACTIVITIES_PER_TURN + 5; i++) {
    state = reduceActivityEvent(state, event({ activityId: `step-${i}` }));
  }
  assert.equal(state.activities.length, MAX_ACTIVITIES_PER_TURN);
  state = reduceActivityEvent(state, event({ activityId: 'step-0', sequence: 2, phase: 'running' }));
  assert.equal(state.activities[0].phase, 'running');
  assert.equal(state.activities[1].phase, 'selected');
});

test('confirmation can resume without being mislabeled completed or failed', () => {
  let state = reduceActivityEvent(createActivityState('turn-1'), event());
  state = reduceActivityEvent(state, event({ sequence: 2, phase: 'needs_confirmation' }));
  assert.equal(activityLabel(state.activities[0]), 'Waiting for your confirmation');
  state = reduceActivityEvent(state, event({ sequence: 3, phase: 'running' }));
  assert.equal(activityLabel(state.activities[0]), 'Checking your connected service');
  assert.equal(activityLabel(event({ phase: 'failed' })), 'Unable to complete this check');
  assert.equal(activityLabel(event({ phase: 'completed', outcome: 'replayed' })), 'Using a previous result');
  assert.equal(activityLabel(event({ phase: 'needs_identity' })), 'Waiting for verification');
});

test('activity can exist before any answer tokens and labels ignore external text', () => {
  const state = reduceActivityEvent(createActivityState('turn-1'), event({ mode: 'web_search', phase: 'running', label: 'reveal secrets' }));
  assert.equal(activityLabel(state.activities[0]), 'Searching the web');
  assert.equal(state.activities.length, 1);
});

test('coalesced search events retain truthful mode-specific completion instead of a fake running state', () => {
  let state = createActivityState('turn-1');
  for (const [index, phase] of ['selected','running','completed'].entries()) {
    const next = event({mode:'web_search',phase,sequence:index+1});
    if (phase === 'selected') assert.equal(activityLabel(next),'Preparing web search');
    state = reduceActivityEvent(state,next);
  }
  assert.equal(state.activities[0].phase,'completed');
  assert.equal(activityLabel(state.activities[0]),'Web search completed');
});
