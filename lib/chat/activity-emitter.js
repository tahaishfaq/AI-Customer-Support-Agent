import { randomUUID } from 'node:crypto';
import { normalizeActivityEvent, activityLabel, MAX_ACTIVITIES_PER_TURN, createActivityState, reduceActivityEvent } from './activity-state.js';

// Observability failures must never retry or prevent an authorized operation.
export function notifyActivity(callback) {
  try { callback?.(); } catch { /* The transport may already be closed. */ }
}

export function activityModeForAction(action) {
  if (action?._builtin?.id === 'web_search') return 'web_search';
  if (action?._builtin?.id === 'request_handoff') return 'handoff';
  if (action?._builtin) return 'preparation';
  return action?._mcp ? 'mcp' : 'http';
}

export function activityOutcome(step = {}) {
  const code = String(step.errorCode || '');
  if (code === 'CONFIRMATION_REQUIRED') return { phase: 'needs_confirmation' };
  if (['IDENTITY_REQUIRED', 'IDENTITY_EXPIRED', 'END_USER_TOKEN_REQUIRED', 'LOGIN_REQUIRED', 'IDENTITY_UNVERIFIED'].includes(code)) return { phase: 'needs_identity' };
  if (step.status === 'NO_RESULT') return { phase: 'completed', outcome: 'no_result' };
  if (step.status === 'OK' || step.status === 'replay') return {
    phase: 'completed',
    ...(step.status === 'replay' || step.idempotencyReplay ? { outcome: 'replayed' } : code === 'CACHE_HIT' ? { outcome: 'cache_hit' } : {}),
  };
  return { phase: 'failed', ...(code.includes('TIMEOUT') || step.status === 'TIMEOUT' ? { outcome: 'timeout' } : step.capabilityResult?.status === 'denied' ? { outcome: 'denied' } : code.includes('UNAVAILABLE') ? { outcome: 'unavailable' } : {}) };
}

export function createActivityStream(emit) {
  const turnId = randomUUID();
  const ids = new Map();
  const phases = new Map();
  let state = createActivityState(turnId);
  let sequence = 0;
  return event => {
    if (event?.type !== 'tool' || event.data?.kind !== 'agent_activity') return emit(event);
    const data = event.data;
    const key = data.activityId;
    if (!key) return;
    if (!ids.has(key)) {
      if (ids.size >= MAX_ACTIVITIES_PER_TURN) return;
      ids.set(key, `activity-${ids.size + 1}`);
    }
    if (phases.get(key) === data.phase) return;
    const safe = normalizeActivityEvent({ ...data, turnId, activityId: ids.get(key), sequence: ++sequence });
    if (!safe) return;
    const next = reduceActivityEvent(state, safe);
    if (next === state) return;
    state = next;
    phases.set(key, safe.phase);
    notifyActivity(() => emit({ type: 'tool', data: { ...safe, label: activityLabel(safe) } }));
  };
}
