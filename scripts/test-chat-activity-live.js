// Opt-in: real local homepage embed, persisted test chats and paid provider requests.
// No auth bypass, API mocks, config changes, automatic write approvals or raw SSE logs.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const cases = [
  { id: 'product', question: 'What exactly is AIDE and how can it help my business?', answer: /customer|support/i },
  { id: 'knowledge', question: 'How do I add FAQs and PDFs to my AIDE agent and embed it on my website?', answer: /knowledge|FAQ|PDF/i },
  { id: 'search', question: 'So can you search on internet is there an y company that provide the same customer service that we are doing', mode: 'web_search', answer: /support|service/i },
  { id: 'signup', question: 'Check whether AIDE is currently allowing new customer registrations using get_aide_signup_availability.', tool: 'get_aide_signup_availability', answer: /register|registration|sign.?up/i },
  { id: 'maintenance', question: 'Check if AIDE is currently in maintenance using get_aide_maintenance_status.', tool: 'get_aide_maintenance_status', answer: /maintenance/i },
  { id: 'plans', question: 'Check the current AIDE subscription plans and prices using get_aide_public_plans.', tool: 'get_aide_public_plans', answer: /plan|pric/i },
];

async function instrumentation() {
  window.__aideAudit = { requests: [], visible: [] };
  const originalFetch = window.fetch;
  window.__aideNegativeChecks = async ({ publicKey, replay = false }) => {
    const result = window.__aideAudit.requests.at(-1)?.result;
    const initial = window.__aideAudit.requests[0]?.result;
    const token = result?.realtimeAccessToken || initial?.realtimeAccessToken;
    const confirmationId = initial?.pendingConfirmations?.[0]?.id;
    const checks = [];
    for (const mode of replay ? ['replay'] : ['missing', 'forged']) {
      const headers = { 'Content-Type':'application/json', Accept:'application/json' };
      if (mode !== 'missing') headers['x-aide-conversation-access-token'] = mode === 'forged' ? 'invalid-fixture-capability' : token || '';
      const body = { conversationId:result.conversationId, ...(mode === 'replay' ? {resumeAfterConfirmationId:confirmationId} : {message:'Verify conversation access guard.'}) };
      const res = await originalFetch(`/api/public/agents/${publicKey}/chat`, {method:'POST',headers,body:JSON.stringify(body)});
      const data = await res.json().catch(()=>({}));
      checks.push({mode,status:res.status,code:data.error?.details?.code || null});
    }
    return checks;
  };
  window.fetch = async (...args) => {
    const url = String(args[0]);
    if (!/\/api\/public\/agents\/[^/]+\/chat$/.test(url)) return originalFetch(...args);
    const entry = { started: performance.now(), activity: [], deltas: 0, errors: [], finished: false };
    window.__aideAudit.requests.push(entry);
    const response = await originalFetch(...args);
    entry.status = response.status;
    entry.sse = response.headers.get('content-type')?.includes('text/event-stream');
    const clone = response.clone();
    void (async () => {
      const consume = (type, data) => {
        const at = performance.now();
        if (type === 'tool' && data?.kind === 'agent_activity') entry.activity.push({ mode: data.mode, phase: data.phase, outcome: data.outcome, at });
        if (type === 'delta') { entry.deltas++; entry.firstDelta ??= at; }
        if (type === 'error') entry.errors.push(String(data?.code || 'CHAT_FAILED').slice(0,80));
        if (type === 'done') {
          // Ephemeral only: IDs/capability are used in negative checks, never reported.
          entry.result = data;
          entry.finished = true;
          entry.ended = at;
        }
      };
      if (!entry.sse) { consume('done', await clone.json()); return; }
      const reader = clone.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 1_048_576) throw new Error('AUDIT_BUFFER_LIMIT');
          let end;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0,end); buffer = buffer.slice(end+2);
            const type = block.match(/^event: (.+)$/m)?.[1];
            const raw = block.match(/^data: (.+)$/m)?.[1];
            if (raw) consume(type, JSON.parse(raw));
          }
        }
      } finally { reader.releaseLock(); entry.finished = true; }
    })().catch(() => { entry.errors.push('AUDIT_READER_FAILED'); entry.finished = true; });
    return response;
  };
  const observe = () => {
    const element = document.querySelector('[data-testid="agent-activity"]');
    if (!element || !element.getClientRects().length) return;
    const text = element.textContent || '';
    // Record only application-owned labels, never answer/tool data.
    const mode = /Searching the web|Preparing web search|Web search completed/.test(text) ? 'web_search' : /Checking your connected service/.test(text) ? 'http' : /knowledge/i.test(text) ? 'knowledge' : /confirmation/i.test(text) ? 'confirmation' : null;
    const phase = /Searching the web/.test(text) ? 'running' : /Preparing web search/.test(text) ? 'selected' : /Web search completed/.test(text) ? 'completed' : null;
    if (mode && (window.__aideAudit.visible.at(-1)?.mode !== mode || window.__aideAudit.visible.at(-1)?.phase !== phase)) window.__aideAudit.visible.push({ mode, phase, at: performance.now() });
  };
  document.addEventListener('DOMContentLoaded', () => new MutationObserver(observe).observe(document.body, { subtree:true, childList:true, characterData:true }));
}

async function main() {
  if (process.env.AIDE_LIVE_ACCEPTANCE !== '1') throw new Error('Set AIDE_LIVE_ACCEPTANCE=1 to authorize real local test chats.');
  if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local target required.');
  const browser = await chromium.launch({ headless:true });
  const report = [];
  const output = path.resolve('.tmp/chat-activity-live');
  await fs.mkdir(output, { recursive:true });
  try {
    for (const scenario of cases.filter(c => !process.env.AIDE_LIVE_CASE || process.env.AIDE_LIVE_CASE.split(',').includes(c.id))) {
      const context = await browser.newContext({ viewport:{width:1280,height:1000} });
      const item = { scenario:scenario.id, checks:{} };
      let stage = 'navigation';
      try {
        await context.addInitScript(instrumentation);
        const page = await context.newPage();
        await page.goto(baseURL);
        const iframe = page.locator('iframe[data-hapy-widget]').first();
        await expect(iframe).toBeVisible({timeout:25000});
        const frame = await (await iframe.elementHandle()).contentFrame();
        stage = 'open-widget';
        await frame.getByRole('button',{name:'Open chat widget'}).click();
        stage = 'agent-title';
        await expect(frame.getByText('AIDE Support Assistant').first()).toBeVisible();
        const input = frame.locator('textarea[placeholder="Type your message..."]');
        stage = 'send-message';
        await input.fill(scenario.question); await input.press('Enter');
        await frame.waitForFunction(() => window.__aideAudit.requests[0]?.finished, { }, { timeout:75000 });
        stage = 'confirmation';
        if (scenario.tool) {
          const pending = await frame.evaluate(() => window.__aideAudit.requests[0].result?.pendingConfirmations?.map(c => ({name:c.actionName})) || []);
          if (pending.length) {
            if (pending.length !== 1 || pending[0].name !== scenario.tool) throw new Error('UNEXPECTED_CONFIRMATION_TARGET');
            await frame.getByRole('button',{name:'Confirm',exact:true}).click();
            await frame.waitForFunction(() => window.__aideAudit.requests[1]?.finished, {}, { timeout:75000 });
          }
        }
        const observed = await frame.evaluate(() => {
          const audit = window.__aideAudit;
          return { visible:audit.visible, requests:audit.requests.map(r => ({
            status:r.status,sse:r.sse,deltas:r.deltas,errors:r.errors,activity:r.activity,
            firstDelta:r.firstDelta,started:r.started,ended:r.ended,
            hasDone:!!r.result,searchUsed:r.result?.searchUsed, degraded:r.result?.degraded,
            sourceCount:r.result?.sources?.length||0,
            knowledgeCount:r.result?.usedKnowledge?.length||0,
            untitled:(r.result?.sources||[]).some(s=>!s.title || /untitled source/i.test(s.title)),
            tools:(r.result?.toolSteps||[]).map(t=>({name:t.name,status:t.status,code:t.errorCode})),
          })) };
        });
        const last = observed.requests.at(-1);
        stage = 'assertions';
        item.checks.sseDone = observed.requests.every(r=>r.status===200 && r.sse && r.hasDone && r.errors.length===0);
        item.checks.textDeltas = last.deltas>0;
        item.checks.answerRelevant = await frame.evaluate(pattern => pattern && new RegExp(pattern,'i').test(window.__aideAudit.requests.at(-1).result?.message?.content||''),scenario.answer.source);
        if (scenario.mode) {
          item.checks.searchExecuted = last.searchUsed === true && last.sourceCount>0;
          item.checks.namedSources = last.sourceCount>0 && !last.untitled;
          item.checks.noUntitledSourceChips = await frame.getByRole('link',{name:'Untitled source',exact:true}).count() === 0;
          item.checks.namedSearchLifecycleBeforeDelta = observed.visible.some(v=>v.mode===scenario.mode && v.at>=last.started && v.at<last.firstDelta);
          item.runningLabelObserved = observed.visible.some(v=>v.mode===scenario.mode && v.phase==='running' && v.at>=last.started && v.at<last.firstDelta);
        }
        if (scenario.tool) {
          item.checks.toolSucceeded = last.tools.some(t=>t.name===scenario.tool && t.status==='OK');
          item.checks.visibleBeforeDelta = observed.visible.some(v=>v.mode==='http' && v.at>=last.started && v.at<last.firstDelta);
        }
        if (['product','knowledge'].includes(scenario.id)) item.checks.noUnneededSearch = !observed.requests.some(r=>r.searchUsed);
        item.observed = observed;
        const publicKey = await iframe.getAttribute('data-hapy-widget');
        if (scenario.id === 'product' || (scenario.tool && observed.requests.length > 1)) {
          item.negative = await frame.evaluate(args => window.__aideNegativeChecks(args), { publicKey, replay:!!scenario.tool });
          item.checks.accessOrReplayDenied = item.negative.every(r=>[400,401,403,404,409,410].includes(r.status));
        }
        await iframe.screenshot({path:path.join(output,`${scenario.id}.png`)});
        item.status = Object.values(item.checks).every(Boolean) ? 'PASS' : 'FAIL';
      } catch (error) { item.status='FAIL'; item.stage=stage; item.errorType=error.name; item.failure = error.name === 'TimeoutError' ? 'TIMEOUT' : ['UNEXPECTED_CONFIRMATION_TARGET'].includes(error.message) ? error.message : 'BROWSER_ASSERTION_FAILED'; }
      finally { await context.close(); }
      report.push(item); console.log(JSON.stringify(item));
      const reportName = process.env.AIDE_LIVE_CASE ? `report-${process.env.AIDE_LIVE_CASE.replace(/[^a-z,-]/g,'')}.json` : 'report.json';
      await fs.writeFile(path.join(output,reportName), JSON.stringify(report,null,2));
    }
  } finally { await browser.close(); }
  if (report.some(r=>r.status!=='PASS')) process.exitCode=1;
}
main().catch(()=>{ console.error('LIVE_ACCEPTANCE_HARNESS_BLOCKED'); process.exitCode=1; });
