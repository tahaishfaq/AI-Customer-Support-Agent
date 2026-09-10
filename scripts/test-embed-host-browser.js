// Real Chromium, generated production embed script, isolated synthetic origins.
// No app server, credentials, database writes or provider calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

const HOST = 'https://host.example.test';
const APP = 'https://widget.example.test';
const OTHER = 'https://other.example.test';
const frameData = { source: 'hapy-widget', type: 'frame', open: false, width: 60, height: 60 };

async function main() {
  const source = fs.readFileSync(path.join(__dirname, '../app/embed.js/route.js'), 'utf8');
  const { GET } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const script = await GET(new Request(`${APP}/embed.js`)).text();
  const browser = await chromium.launch({ headless: true });
  let failures = 0;
  async function run(name, test, options = {}) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    let release;
    const pingGate = new Promise(resolve => { release = resolve; });
    if (!options.delayPing) release();
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === HOST) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><button id="host-button">Host action</button><div id="container" style="width:600px;height:600px"></div><script src="' + APP + '/embed.js" data-aide-key="fixture"' + (options.container ? ' data-aide-target="#container"' : '') + '></script>' });
      if (url.origin === APP && url.pathname === '/embed.js') return route.fulfill({ contentType: 'text/javascript', body: script });
      if (url.origin === APP && url.pathname.endsWith('/ping')) {
        await pingGate;
        return route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: JSON.stringify({ widgetPosition: options.anchor || 'bottom-right' }) }).catch(() => {});
      }
      if (url.origin === APP || url.origin === OTHER) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><script>window.received = []; addEventListener("message", e => { if(e.data?.type === "setUser") received.push(e.data.user ? "user" : "clear"); });</script>' });
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(HOST);
      await expect(page.locator('iframe[data-hapy-widget]')).toHaveCount(1);
      await expect.poll(() => page.frames().some(frame => frame.url().startsWith(`${APP}/w/`))).toBe(true);
      const frame = page.frames().find(item => item.url().startsWith(`${APP}/w/`));
      await frame.waitForLoadState();
      const send = async data => {
        await frame.evaluate(({ data, host }) => parent.postMessage(data, host), { data, host: HOST });
        await page.waitForTimeout(80); // let asynchronous cross-origin messages settle
      };
      const box = () => page.locator('iframe[data-hapy-widget]').boundingBox();
      await test({ page, frame, send, box, release });
      assert.deepEqual(errors, []);
      console.log(`PASS ${name}`);
    } catch (error) {
      failures++;
      console.error(`FAIL ${name}: ${error.message}`);
    } finally {
      release();
      await context.close();
    }
  }
  try {
    await run('initial frame matches legacy child gutter without four-pixel drift', async ({ box, send }) => {
      const before = await box();
      await send(frameData);
      assert.deepEqual(await box(), before);
    });
    await run('configured left anchor is applied before first visible frame', async ({ page, send, release }) => {
      await send(frameData);
      await expect(page.locator('iframe')).toHaveCSS('visibility', 'hidden');
      release();
      await expect(page.locator('iframe')).toHaveCSS('visibility', 'visible');
      await expect(page.locator('iframe')).toHaveCSS('left', '16px');
    }, { delayPing: true, anchor: 'bottom-left' });
    await run('late ping cannot move a revealed fallback launcher', async ({ page, send, box, release }) => {
      await send(frameData);
      await expect(page.locator('iframe')).toHaveCSS('visibility', 'visible', { timeout: 4000 });
      const before = await box();
      release();
      await page.waitForTimeout(100);
      assert.deepEqual(await box(), before);
    }, { delayPing: true, anchor: 'bottom-left' });
    await run('identity is delivered only to the configured embed origin', async ({ page, frame, send }) => {
      await send({ source: 'hapy-widget', type: 'ready' });
      await page.evaluate(() => window.aideChat.setUser({ subject: 'fixture-user', accessToken: 'SYNTHETIC-TEST-ONLY' }));
      await expect.poll(() => frame.evaluate(() => received.includes('user'))).toBe(true);
      await frame.goto(OTHER);
      await page.evaluate(() => window.aideChat.setUser({ subject: 'fixture-user', accessToken: 'SYNTHETIC-TEST-ONLY' }));
      await page.waitForTimeout(100);
      assert.equal(await frame.evaluate(() => received.length), 0);
    });
    await run('malformed resize envelopes do not change frame geometry', async ({ send, box }) => {
      await send(frameData);
      const before = await box();
      for (const invalid of [
        { width: '400', height: 300 }, { width: -1, height: 300 },
        { width: NaN, height: 300 }, { width: Infinity, height: 300 },
        { width: 1e9, height: 300 }, { width: 300, height: 0 },
        { width: 300, height: 300, open: 'true' },
      ]) {
        await send({ ...frameData, ...invalid });
        assert.deepEqual(await box(), before);
      }
    });
    await run('wrong origin and wrong source window cannot resize or remove', async ({ page, send, box }) => {
      await send(frameData);
      const before = await box();
      await page.evaluate(app => {
        const iframe = document.querySelector('iframe');
        for (const type of ['frame', 'unavailable']) {
          const data = { source: 'hapy-widget', type, open: true, width: 380, height: 580 };
          dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example.test', source: iframe.contentWindow, data }));
          dispatchEvent(new MessageEvent('message', { origin: app, source: window, data }));
        }
      }, APP);
      assert.deepEqual(await box(), before);
    });
    await run('viewport resize re-clamps both edges without a new child event', async ({ page, send, box }) => {
      await send({ ...frameData, open: true, width: 384, height: 592 });
      await page.setViewportSize({ width: 320, height: 480 });
      await expect.poll(async () => {
        const rect = await box();
        return rect.x >= 16 && rect.y >= 16 && rect.x + rect.width <= 304 && rect.y + rect.height <= 464;
      }).toBe(true);
    });
    await run('duplicate dimensions do not mutate iframe styles', async ({ page, send }) => {
      await send(frameData);
      await page.evaluate(() => {
        window.styleWrites = 0;
        new MutationObserver(rows => { window.styleWrites += rows.length; }).observe(document.querySelector('iframe'), { attributes: true, attributeFilter: ['style'] });
      });
      for (let i = 0; i < 4; i++) await send(frameData);
      assert.equal(await page.evaluate(() => window.styleWrites), 0);
    });
    await run('duplicate init keeps one iframe and host buttons remain usable', async ({ page, send }) => {
      await send(frameData);
      await page.evaluate(() => { aideChat.init({ publicKey: 'fixture' }); aideChat.init({ publicKey: 'fixture' }); });
      await expect(page.locator('iframe[data-hapy-widget]')).toHaveCount(1);
      await page.locator('#host-button').click();
    });
    await run('versioned frame is acknowledged and stale generations cannot shrink it', async ({ frame, send, box }) => {
      await frame.evaluate(() => { window.acks = []; addEventListener('message', e => { if(e.data?.type === 'frame-applied') acks.push(e.data); }); });
      await send({ ...frameData, version: 2, generation: 2, position: 'bottom-right', open: true, width: 384, height: 592 });
      await expect.poll(() => frame.evaluate(() => acks.length)).toBeGreaterThan(0);
      assert.equal(await frame.evaluate(() => acks.at(-1).generation), 2);
      const before = await box();
      await send({ ...frameData, version: 2, generation: 1, position: 'bottom-right' });
      assert.deepEqual(await box(), before);
      await send({ ...frameData, version: 2, generation: 3, position: 'bottom-right' });
      assert.equal((await box()).width, 60);
    });
    await run('container embed keeps host dimensions and ignores floating messages', async ({ page, send, box }) => {
      const before = await box();
      assert.equal(before.width, 600);
      await send({ ...frameData, open: true, width: 384, height: 592 });
      assert.deepEqual(await box(), before);
      await expect(page.locator('iframe')).not.toHaveCSS('position', 'fixed');
    }, { container: true });
    await run('unsupported anchor fails to the fixed bottom-right default', async ({ page, send }) => {
      await send(frameData);
      await expect(page.locator('iframe')).toHaveCSS('visibility', 'visible');
      await expect(page.locator('iframe')).toHaveCSS('right', '16px');
      await expect(page.locator('iframe')).toHaveCSS('bottom', '16px');
    }, { anchor: 'center-left' });
    await run('unavailable removes the widget and allows clean reinitialization', async ({ page, send }) => {
      await send({ source: 'hapy-widget', type: 'unavailable' });
      await expect(page.locator('iframe[data-hapy-widget]')).toHaveCount(0);
      assert.equal(await page.evaluate(() => Boolean(window.__hapyEmbedKeys.fixture)), false);
      await page.evaluate(() => aideChat.init({ publicKey: 'fixture' }));
      await expect(page.locator('iframe[data-hapy-widget]')).toHaveCount(1);
      await page.setViewportSize({ width: 390, height: 844 });
    });
  } finally {
    await browser.close();
  }
  if (failures) throw new Error(`${failures} embed-host cases failed`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
