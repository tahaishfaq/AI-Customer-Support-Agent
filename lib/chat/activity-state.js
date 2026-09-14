// Pure display state only: these events cannot authorize or execute an action.
export const MAX_ACTIVITIES_PER_TURN = 32;
const MODES = new Set(['preparation', 'knowledge', 'http', 'mcp', 'web_search', 'hybrid', 'handoff']);
const PHASES = new Set(['selected', 'validating', 'running', 'needs_confirmation', 'needs_identity', 'completed', 'failed', 'cancelled']);
const OUTCOMES = new Set(['cache_hit', 'replayed', 'denied', 'timeout', 'unavailable', 'no_result']);
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
const NEXT = {
  selected: new Set(['validating', 'running', 'needs_confirmation', 'needs_identity', ...TERMINAL]),
  validating: new Set(['running', 'needs_confirmation', 'needs_identity', ...TERMINAL]),
  running: new Set(['needs_confirmation', 'needs_identity', ...TERMINAL]),
  needs_confirmation: new Set(['validating', 'running', 'needs_identity', ...TERMINAL]),
  needs_identity: new Set(['validating', 'running', 'needs_confirmation', ...TERMINAL]),
};
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,96}$/.test(value);

export function normalizeActivityEvent(value) {
  if (!value || value.kind !== 'agent_activity' || !validId(value.turnId) || !validId(value.activityId)) return null;
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 0 || !MODES.has(value.mode) || !PHASES.has(value.phase)) return null;
  if (value.outcome !== undefined && !OUTCOMES.has(value.outcome)) return null;
  return {
    kind: 'agent_activity', turnId: value.turnId, activityId: value.activityId,
    sequence: value.sequence, mode: value.mode, phase: value.phase,
    ...(value.outcome === undefined ? {} : { outcome: value.outcome }),
  };
}

export function createActivityState(turnId) {
  if (!validId(turnId)) throw new Error('Invalid activity turn ID');
  return { turnId, closed: false, activities: [] };
}

export function reduceActivityEvent(state, rawEvent) {
  const event = normalizeActivityEvent(rawEvent);
  if (state.closed || !event || event.turnId !== state.turnId) return state;
  const index = state.activities.findIndex(item => item.activityId === event.activityId);
  if (index === -1) {
    if (state.activities.length >= MAX_ACTIVITIES_PER_TURN) return state;
    return { ...state, activities: [...state.activities, event] };
  }
  const previous = state.activities[index];
  if (event.sequence <= previous.sequence || event.mode !== previous.mode || TERMINAL.has(previous.phase)) return state;
  if (event.phase !== previous.phase && !NEXT[previous.phase]?.has(event.phase)) return state;
  return { ...state, activities: state.activities.map((item, i) => i === index ? event : item) };
}

export function closeActivityState(state) {
  return { ...state, closed: true };
}

export function activityLabel(event) {
  if (event.phase === 'needs_confirmation') return 'Waiting for your confirmation';
  if (event.phase === 'needs_identity') return 'Waiting for verification';
  if (event.phase === 'failed') return 'Unable to complete this check';
  if (event.phase === 'cancelled') return 'Stopped waiting for this action';
  if (event.phase === 'completed') {
    if (event.outcome === 'cache_hit' || event.outcome === 'replayed') return 'Using a previous result';
    if (event.outcome === 'no_result') return 'No matching result found';
    return {
      web_search: 'Web search completed', knowledge: 'Knowledge check completed',
      http: 'Connected service check completed', mcp: 'Connected tools check completed',
      hybrid: 'Source comparison completed', handoff: 'Human support requested',
    }[event.mode] || 'Check completed';
  }
  if (event.phase === 'validating') return 'Checking access';
  if (event.phase === 'selected') return {
    web_search: 'Preparing web search', knowledge: 'Preparing knowledge check',
    http: 'Preparing connected service check', mcp: 'Preparing connected tools check',
    hybrid: 'Preparing source comparison', handoff: 'Preparing human support request',
  }[event.mode] || 'Preparing this check';
  return {
    preparation: 'Preparing your response', knowledge: 'Checking the knowledge base',
    http: 'Checking your connected service', mcp: 'Checking connected tools',
    web_search: 'Searching the web', hybrid: 'Comparing sources', handoff: 'Requesting human support',
  }[event.mode] || 'Preparing your response';
}
