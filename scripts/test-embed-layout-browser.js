const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { build } = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const { chromium, expect } = require('@playwright/test');

const HOST = 'https://host.example.test';
const APP = 'https://widget.example.test';
async function main() {
  const root = path.resolve(__dirname, '..');
  const bundle = await build({
    absWorkingDir: root, write: false, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'jsx', contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {ChatWidget} from './components/chat/ChatWidget';
      import {useEmbedFrame} from './hooks/use-embed-frame';
      function Fixture() {
        const [open,setOpen]=useState(false);
        const config=window.fixture;
        const layout=useEmbedFrame({enabled:true,open,proactive:!open&&config.proactive,customLauncher:config.custom,position:config.position,parentOrigin:'${HOST}'});
        return <ChatWidget agent={{name:'AIDE'}} customization={{appearance:{theme:config.theme},deploy:{chatLauncher:config.custom?'custom':'default',proactiveEnabled:config.proactive,proactiveMessage:'Can we help?'},features:{conversationHistory:false}}} open={open} onToggle={()=>setOpen(v=>!v)} coordinatedFrame panelReady={layout.panelReady} align={layout.position==='bottom-left'?'start':'end'}>
          <textarea aria-label="Draft" /><div style={{overflow:'auto',flex:1}}>Fixture conversation</div>
        </ChatWidget>;
      }
      createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);
      window.clipped=[]; window.frameRequests=0;
      function sample(){
        const el=document.querySelector('[data-testid="embed-panel-surface"]');
        if(el&&!el.hidden){const r=el.getBoundingClientRect();if(r.x < -1||r.y < -1||r.right>innerWidth+1||r.bottom>innerHeight+1)clipped.push({width:innerWidth,height:innerHeight});}
        requestAnimationFrame(sample);
      } requestAnimationFrame(sample);
    ` },
  });
  const cssPath = path.join(root, 'app/globals.css');
  const css = await postcss([tailwind()]).process(fs.readFileSync(cssPath, 'utf8'), { from: cssPath });
  const current = fs.readFileSync(path.join(root, 'app/embed.js/route.js'), 'utf8');
  const legacy = execFileSync('git', ['show', 'HEAD:app/embed.js/route.js'], { cwd: root, encoding: 'utf8' });
  const browser = await chromium.launch();
  try {
    for (const scenario of [
      { name:'right/desktop', position:'bottom-right', width:1366 },
      { name:'left/mobile', position:'bottom-left', width:390 },
      { name:'custom/proactive', position:'bottom-right', width:390, custom:true, proactive:true },
      { name:'cached legacy host', position:'bottom-right', width:390, legacy:true },
      { name:'lost acknowledgement', position:'bottom-right', width:390, dropAck:true },
    ]) {
      const context = await browser.newContext({viewport:{width:scenario.width,height:844},reducedMotion:'reduce'});
      const source = scenario.legacy ? legacy : current;
      const { GET } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
      const script = await GET(new Request(`${APP}/embed.js`)).text();
      await context.addInitScript(({scenario,app})=>{
        window.fixture={position:scenario.position,custom:Boolean(scenario.custom),proactive:Boolean(scenario.proactive),theme:scenario.custom?'dark':'light'};
        if(location.origin===app && scenario.dropAck) addEventListener('message',e=>{if(e.data?.type==='frame-applied')e.stopImmediatePropagation();});
      },{scenario,app:APP});
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin===HOST)return route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><button id="outside">Host</button><script src="${APP}/embed.js" data-aide-key="fixture"></script>`});
        if(url.pathname==='/embed.js')return route.fulfill({contentType:'text/javascript',body:script});
        if(url.pathname.endsWith('/ping'))return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'},body:JSON.stringify({widgetPosition:scenario.position})});
        if(url.pathname==='/style.css')return route.fulfill({contentType:'text/css',body:css.css});
        if(url.pathname==='/bundle.js')return route.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});
        if(url.pathname.startsWith('/w/'))return route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script>'});
        return route.abort();
      });
      try {
        const page=await context.newPage(); const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(HOST);
        const frame=page.frameLocator('iframe[data-hapy-widget]');
        const launcher=()=>frame.getByRole('button',{name:/^(Open|Close) chat widget$/});
        await expect(launcher()).toBeVisible();
        // Legacy starts at 56 then adopts the known requested bounds asynchronously.
        await page.waitForTimeout(600);
        const before=await launcher().boundingBox();
        await launcher().click();
        await expect(frame.getByTestId('embed-panel-surface')).toBeVisible();
        const after=await launcher().boundingBox();
        assert.ok(Math.abs(before.x-after.x)<=1 && Math.abs(before.y-after.y)<=1,'launcher remains anchored');
        await frame.getByLabel('Draft').fill('Keep this draft');
        await launcher().click();
        await expect(frame.getByTestId('embed-panel-surface')).toBeHidden();
        await launcher().click();
        await expect(frame.getByLabel('Draft')).toHaveValue('Keep this draft');
        for(let i=0;i<8;i++)await launcher().evaluate(el=>el.click());
        await expect(frame.getByTestId('embed-panel-surface')).toBeVisible();
        await page.setViewportSize({width:320,height:480});
        await page.waitForTimeout(150);
        if(!scenario.legacy){
          const rect=await page.locator('iframe').boundingBox();
          assert.ok(rect.x>=15&&rect.y>=15&&rect.x+rect.width<=305&&rect.y+rect.height<=465,'both viewport edges');
        }
        await page.locator('#outside').click();
        const child=page.frames().find(f=>f.url().startsWith(`${APP}/w/`));
        assert.deepEqual(await child.evaluate(()=>clipped),[],'no panel rendered outside its frame');
        assert.deepEqual(errors,[]);
        console.log(`PASS ${scenario.name}: resize-before-reveal, stable launcher, rapid toggles, draft retention, no clipping`);
      } finally {await context.close();}
    }
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
