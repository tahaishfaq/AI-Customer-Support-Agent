const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { build } = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const { chromium, expect } = require('@playwright/test');

async function main() {
  const root = path.resolve(__dirname, '..');
  const bundle = await build({
    entryPoints: ['tests/fixtures/chat-activity.jsx'], absWorkingDir: root,
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'framework-test-shell', setup(builder) {
      builder.onResolve({ filter: /^next\/(navigation|link|image)$/ }, args => ({ path: args.path, namespace: 'test-shell' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-shell' }, args => ({
        contents: args.path.endsWith('navigation')
          ? 'const params = new URLSearchParams(); export const useSearchParams = () => params; export const usePathname = () => location.pathname; export const useRouter = () => ({push(){},replace(){}});'
          : `import React from 'react'; export default function Component({children, ...props}) { return React.createElement('${args.path.endsWith('image') ? 'img' : 'a'}', props, children); }`,
        resolveDir: root,
      }));
      if (process.env.ACTIVITY_BASELINE === '1') builder.onLoad({ filter: /components\/chat\/MessageList\.jsx$/ }, () => ({
        contents: execFileSync('git', ['show', 'HEAD:components/chat/MessageList.jsx'], { cwd: root, encoding: 'utf8' }), loader: 'jsx', resolveDir: path.join(root, 'components/chat'),
      }));
    } }],
  });
  const css = await postcss([tailwind()]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') });
  const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('content-type', 'text/javascript'); res.end(bundle.outputFiles[0].text); }
    else if (req.url === '/style.css') { res.setHeader('content-type', 'text/css'); res.end(css.css); }
    else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const channel of ['embed', 'workspace', 'studio']) {
      for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: theme === 'light' ? 390 : 1280, height: 844 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        window.__agent = { id: 'fixture-agent', publicKey: 'fixture-public', name: 'AIDE Support', customization: { appearance: { theme, messageStyle:'darker' }, deploy: { chatInterface: 'embedded' }, features: { notificationSound: false, conversationHistory: true } } };
        window.__streams = [];
        window.__cancelled = [];
        window.__requests = [];
        window.fetch = async (input, options = {}) => {
          const url = String(input);
          window.__requests.push({ url, body: options.body ? JSON.parse(options.body) : null, headers: options.headers });
          if (url.endsWith('/chat') && window.__jsonReply) return new Response(JSON.stringify(window.__jsonReply), { headers: { 'content-type': 'application/json' } });
          if (url.endsWith('/chat')) {
            const index = window.__streams.length;
            return new Response(new ReadableStream({ start(controller) { window.__streams.push(controller); }, cancel() { window.__cancelled[index] = true; } }), { headers: { 'content-type': 'text/event-stream' } });
          }
          const data = url === '/api/agents' ? { agents: [window.__agent] } : {};
          return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
        };
        window.__event = (type, data, index = 0) => { if (!window.__cancelled[index]) window.__streams[index].enqueue(new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)); };
        window.__close = index => { if (!window.__cancelled[index]) window.__streams[index].close(); };
      }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/${channel}`);
      const input = page.getByPlaceholder(channel === 'studio' ? 'Type your own test as a visitor…' : 'Type your message...', { exact: true });
      await expect(input).toBeVisible();
      await input.fill('Search online for AIDE alternatives');
      await input.press('Enter');
      await expect.poll(() => page.evaluate(() => window.__streams.length)).toBe(1);
      await expect(page.getByTestId('agent-activity')).toHaveCount(0);
      await expect(page.getByLabel('Assistant is typing')).toBeVisible();
      const event = { kind: 'agent_activity', turnId: 'turn-1', activityId: 'search-1', sequence: 1, mode: 'web_search', phase: 'running', label: 'UNTRUSTED SECRET LABEL' };
      await page.evaluate(event => window.__event('tool', event), event);
      await expect(page.getByTestId('agent-activity')).toContainText('Searching the web');
      await expect(page.getByText('UNTRUSTED SECRET LABEL')).toHaveCount(0);
      await expect(page.getByTestId('agent-activity')).toHaveCount(1);
      await expect(page.getByTestId('agent-activity').locator('svg')).toHaveCSS('animation-name', 'none');
      await page.evaluate(() => window.__event('delta', { text: 'First answer token' }));
      await expect(page.getByText('First answer token', { exact: true })).toBeVisible();
      await expect(page.getByTestId('agent-activity')).toHaveCount(1);
      await page.evaluate(event => window.__event('tool', { ...event, sequence: 2, phase: 'needs_confirmation' }), event);
      await expect(page.getByTestId('agent-activity')).toContainText('Waiting for your confirmation');
      await page.evaluate(event => window.__event('tool', { ...event, sequence: 1 }), event);
      await expect(page.getByTestId('agent-activity')).toContainText('Waiting for your confirmation');
      await page.evaluate(event => window.__event('tool', { ...event, turnId: 'wrong-turn', activityId: 'wrong', sequence: 99, mode: 'http' }), event);
      await expect(page.getByTestId('agent-activity').locator('[data-phase]')).toHaveCount(1);
      await page.evaluate(event => {
        window.__event('tool', { ...event, activityId: 'invalid', phase: 'approve_write' });
        window.__event('tool', { ...event, activityId: 'invalid-sequence', sequence: -1 });
      }, event);
      await expect(page.getByTestId('agent-activity').locator('[data-phase]')).toHaveCount(1);
      for (const [mode, label] of [['knowledge', 'Checking the knowledge base'], ['http', 'Checking your connected service'], ['mcp', 'Checking connected tools'], ['hybrid', 'Comparing sources'], ['handoff', 'Requesting human support']]) {
        await page.evaluate(({ event, mode }) => window.__event('tool', { ...event, activityId: mode, mode }), { event, mode });
        await expect(page.getByTestId('agent-activity')).toContainText(label);
      }
      await page.evaluate(event => window.__event('tool', { ...event, activityId: 'http', mode: 'http', sequence: 2, phase: 'failed' }), event);
      await expect(page.getByTestId('agent-activity')).toContainText('Unable to complete this check');
      await expect(page.getByTestId('agent-activity')).not.toContainText('Completed checks');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      fs.mkdirSync(path.join(root, '.tmp/chat-activity'), { recursive: true });
      await page.screenshot({ path: path.join(root, `.tmp/chat-activity/${channel}-${theme}.png`) });
      await page.evaluate(() => {
        window.__event('done', { conversationId: 'fixture-conversation', userMessage: { id: 'user-1', role: 'USER', content: 'Search online for AIDE alternatives' }, message: { id: 'assistant-1', role: 'ASSISTANT', content: 'Final answer' }, pendingConfirmations: [{ id: 'confirm-1', conversationId: 'fixture-conversation', status: 'PENDING', actionName: 'AIDE public plans', actionDescription:'Fetch current AIDE public subscription plans, prices and limits when a visitor asks about plans or pricing.', expiresAt: new Date(Date.now() + 600000).toISOString() }], toolSteps: [] });
        window.__streams[0].close();
      });
      await expect(page.getByText('Final answer', { exact: true })).toBeVisible();
      await expect(page.getByTestId('agent-activity')).toHaveCount(0);
      await expect(input).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
      const confirmationCard = page.getByTestId('action-confirm-card').first();
      await expect(confirmationCard).toBeVisible();
      await expect(confirmationCard).toContainText('Confirmation required');
      const contrast = await confirmationCard.evaluate(card => {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
        const ctx=canvas.getContext('2d');
        const luminance=color=>{
          ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);
          const [r,g,b]=ctx.getImageData(0,0,1,1).data;
          return [r,g,b].map(x=>{const v=x/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
        };
        const background=getComputedStyle(card).backgroundColor;
        return { overflow:card.scrollWidth>card.clientWidth+1, themed:!!card.style.getPropertyValue('--foreground'), ratios:[...card.querySelectorAll('p,button')].map(el=>{
          const style=getComputedStyle(el);const fg=luminance(style.color);
          const bg=luminance(style.backgroundColor==='rgba(0, 0, 0, 0)'?background:style.backgroundColor);
          return (Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05);
        }) };
      });
      assert.equal(contrast.overflow,false);
      if (contrast.themed) assert.ok(contrast.ratios.every(ratio=>ratio>=4.5),JSON.stringify(contrast));
      await confirmationCard.screenshot({path:path.join(root,`.tmp/chat-activity/confirmation-${channel}-${theme}.png`)});
      await input.fill('Another question');
      await input.press('Enter');
      await expect.poll(() => page.evaluate(() => window.__streams.length)).toBe(2);
      await page.evaluate(event => {
        window.__event('tool', { ...event, turnId: 'turn-2' }, 1);
        window.__event('delta', { text: 'Partial answer to discard' }, 1);
      }, event);
      await expect(page.getByText('Partial answer to discard', { exact: true })).toBeVisible();
      await page.evaluate(() => { window.__event('error', { message: 'Fixture stream failed' }, 1); window.__streams[1].close(); });
      await expect(page.getByText('Fixture stream failed', { exact: true })).toBeVisible();
      await expect(page.getByTestId('agent-activity')).toHaveCount(0);
      await expect(page.getByText('Partial answer to discard', { exact: true })).toHaveCount(0);
      await expect(input).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
      await input.fill('Reset while this request is pending');
      await input.press('Enter');
      await expect.poll(() => page.evaluate(() => window.__streams.length)).toBe(3);
      await page.evaluate(event => {
        for (const [index, phase] of ['selected','running','completed'].entries()) {
          window.__event('tool', { ...event, turnId:'coalesced-turn', phase, sequence:index+1 }, 2);
        }
      }, event);
      await expect(page.getByTestId('agent-activity')).toContainText('Web search completed');
      await expect(page.getByTestId('agent-activity')).not.toContainText('Searching the web');
      await expect(page.getByTestId('agent-activity').locator('[data-phase="completed"]')).toHaveCount(1);
      await page.getByRole('button', { name: 'Open chat history', exact: true }).click();
      await page.getByRole('button', { name: 'New', exact: true }).click();
      await expect(input).toBeEnabled();
      await expect.poll(() => page.evaluate(() => window.__cancelled[2])).toBe(true);
      await page.evaluate(event => {
        window.__event('tool', { ...event, turnId: 'late-turn' }, 2);
        window.__event('delta', { text: 'Late text must not enter new chat' }, 2);
        window.__event('done', { conversationId: 'old-conversation', userMessage: { id: 'old-user', role: 'USER', content: 'Old question' }, message: { id: 'old-assistant', role: 'ASSISTANT', content: 'Late final must not enter new chat' } }, 2);
        window.__close(2);
      }, event);
      await input.fill('New owned request');
      await input.press('Enter');
      await expect.poll(() => page.evaluate(() => window.__streams.length)).toBe(4);
      await expect(page.getByTestId('agent-activity')).toHaveCount(0);
      await expect(page.getByText(/Late (text|final) must not enter new chat/)).toHaveCount(0);
      await page.evaluate(() => { window.__event('error', { message: 'End fixture' }, 3); window.__streams[3].close(); });
      await expect(input).toBeEnabled();
      await page.evaluate(() => { window.__jsonReply = { conversationId: 'json-conversation', realtimeAccessToken: 'fixture-capability', userMessage: { id: 'json-user', role: 'USER', content: 'JSON request' }, message: { id: 'json-answer', role: 'ASSISTANT', content: 'JSON fallback still works' }, pendingConfirmations: [{ id: 'confirm-resume', conversationId: 'json-conversation', status: 'PENDING', actionName: 'AIDE plans' }] }; });
      await input.fill('JSON request');
      await input.press('Enter');
      await expect(page.getByText('JSON fallback still works', { exact: true })).toBeVisible();
      await expect(page.getByTestId('agent-activity')).toHaveCount(0);
      await page.evaluate(() => { window.__jsonReply = null; });
      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.__streams.length)).toBe(5);
      const resumeRequest = await page.evaluate(() => window.__requests.filter(request => request.body?.resumeAfterConfirmationId).at(-1));
      assert.equal(resumeRequest.body.resumeAfterConfirmationId, 'confirm-resume');
      assert.equal(resumeRequest.body.stream, true);
      assert.equal(resumeRequest.body.message, undefined);
      if (channel === 'embed') assert.equal(resumeRequest.headers['x-aide-conversation-access-token'], 'fixture-capability');
      await page.evaluate(event => window.__event('tool', { ...event, turnId: 'approved-turn', mode: 'http' }, 4), event);
      await expect(page.getByTestId('agent-activity')).toContainText('Checking your connected service');
      await page.evaluate(() => window.__event('delta', { text: 'Approved execution is streaming' }, 4));
      await expect(page.getByText('Approved execution is streaming', { exact: true })).toBeVisible();
      await page.evaluate(() => {
        window.__event('done', { conversationId: 'json-conversation', message: { id: 'approved-answer', role: 'ASSISTANT', content: 'Approved execution complete' } }, 4);
        window.__close(4);
      });
      await expect(page.getByText('Approved execution complete', { exact: true })).toBeVisible();
      await expect(page.getByTestId('agent-activity')).toHaveCount(0);
      await expect(page.getByText('JSON request', { exact: true })).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
      assert.equal(await page.evaluate(() => window.__requests.filter(request => request.body?.resumeAfterConfirmationId).length), 1);
      assert.deepEqual(errors, []);
      console.log(`PASS ${channel}/${theme}: pre-token activity, typing, all modes, text, confirmation controls, stale events/reset, error cleanup, done, JSON fallback, viewport, reduced motion`);
      await context.close();
      }
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
