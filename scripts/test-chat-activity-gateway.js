import assert from 'node:assert/strict';

async function main() {
// Isolated process fixture: any unexpected database or outbound work fails.
const auditRows = [];
globalThis.prismaGen = 'email-delivery-v1';
globalThis.prisma = new Proxy({}, {
  get: (_target, model) => new Proxy({}, {
    get: (_value, method) => async (args) => {
      if (model === 'toolRun' && method === 'create') { auditRows.push(args.data); return {}; }
      throw new Error(`Unexpected fixture database call: ${String(model)}.${String(method)}`);
    },
  }),
});
let outbound = 0;
globalThis.fetch = async () => { outbound++; throw new Error('Unexpected outbound request'); };
const { invokeOneTool } = await import('../lib/actions/invoke-tool.js');
const { activityOutcome } = await import('../lib/chat/activity-emitter.js');
let running = 0;
const base = { id: 'fixture-action', agentId: 'fixture-agent', name: 'lookup', enabled: true, version: 1, method: 'GET', inputSchemaJson: { type: 'object', properties: {} }, identityMode: 'NONE', riskLevel: 'READ' };
const cases = [
  [{ enabled: false }, {}, 'DISABLED', 'failed'],
  [{ agentId: 'another-agent' }, {}, 'UNKNOWN_TOOL', 'failed'],
  [{ identityMode: 'END_USER_TOKEN' }, {}, 'IDENTITY_REQUIRED', 'needs_identity'],
  [{ identityMode: 'END_USER_TOKEN' }, { customerSubject: 'fixture-visitor' }, 'END_USER_TOKEN_REQUIRED', 'needs_identity'],
  [{ requiresConfirmation: true }, {}, 'CONFIRMATION_REQUIRED', 'needs_confirmation'],
  [{}, { publicAccess: true }, 'CONFIRMATION_REQUIRED', 'needs_confirmation'],
];
for (const mcp of [false, true]) {
  for (const [overrides, context, code, phase] of cases) {
    const action = { ...base, ...(mcp ? { _mcp: { remoteName: 'lookup' } } : {}), ...overrides };
    const step = await invokeOneTool({ name: 'lookup', argsRaw: '{}', byName: new Map([['lookup', action]]), agentId: 'fixture-agent', stepsUsed: 1, maxSteps: 3, onDispatch: () => running++, ...context });
    assert.equal(step.errorCode, code);
    assert.equal(activityOutcome(step).phase, phase);
  }
}
assert.equal(running, 0);
assert.equal(outbound, 0);
assert.equal(auditRows.length, 12);
console.log('PASS: 12 HTTP/MCP gateway deny, identity and confirmation cases; zero dispatches; audits preserved (fixture database).');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
