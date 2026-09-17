import assert from 'node:assert/strict';
import { routeSource, filterCapabilitiesForSourceRoute } from '../lib/services/ai/source-policy.js';

const exactQuestion = 'So can you search on internet is there an y company that provide the same customer service that we are doing';
const webRequests = [exactQuestion, 'Search on the internet for AIDE alternatives', 'Search on web for AIDE alternatives', 'Search on the web for AIDE alternatives', 'Search the internet for AIDE alternatives', 'Search online for AIDE alternatives', 'Search  on  the  internet for AIDE alternatives'];
for (const question of webRequests) {
  const decision = routeSource(question, { webSearchEnabled: true });
  assert.equal(decision.route, 'WEB', question);
  assert.equal(decision.mayInvokeWebSearch, true, question);
  assert.equal(filterCapabilitiesForSourceRoute([{ name: 'web_search' }], decision).length, 1);
  assert.equal(routeSource(question, { webSearchEnabled: false }).mayInvokeWebSearch, false);
}
for (const question of ['What is AIDE?', 'What is my subscription price?']) {
  assert.equal(routeSource(question).mayInvokeWebSearch, false, question);
}
assert.equal(routeSource('Search on the internet and compare my store price with online prices').route, 'MIXED');
assert.deepEqual(
  filterCapabilitiesForSourceRoute(
    [{ name: 'web_search', entities: ['WEB'] }],
    routeSource('Search online for Shopify pricing')
  ).map((capability) => capability.name),
  ['web_search']
);
assert.deepEqual(routeSource('What are your plans and is signup open?').signals.entities, ['PLANS', 'SIGNUP']);
const scoped = filterCapabilitiesForSourceRoute([
  { name: 'public_plans', entities: ['PLANS'] },
  { name: 'signup_status', entities: ['SIGNUP'] },
  { name: 'maintenance_status', entities: ['MAINTENANCE'] },
], routeSource('What are your plans?'));
assert.deepEqual(scoped.map((capability) => capability.name), ['public_plans']);

const prefQ = 'Please update my preference: set key newsletter to weekly';
const prefRoute = routeSource(prefQ, { webSearchEnabled: true });
assert.equal(prefRoute.route, 'STORE', prefQ);
assert.ok(prefRoute.signals.entities.includes('ACCOUNT'), prefQ);
const prefTools = filterCapabilitiesForSourceRoute(
  [
    { name: 'update_preference', riskLevel: 'WRITE', entities: [] },
    { name: 'request_handoff', riskLevel: 'READ', entities: ['SUPPORT'] },
    { name: 'web_search', riskLevel: 'READ', entities: ['WEB'] },
  ],
  prefRoute
).map((c) => c.name);
assert.deepEqual(prefTools.sort(), ['request_handoff', 'update_preference'].sort());

console.log('Search phrasing regression passed: explicit web requests, disabled flag, general/store boundaries, mixed route, preference STORE');
