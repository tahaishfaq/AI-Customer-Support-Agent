import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeHttpAction, MAX_GUEST_RESPONSE_CHARS } from '../lib/actions/http-executor.js';

const options = { urlTemplate:'http://127.0.0.1:3000/api/billing/plans', allowLocalDemo:true, guestResponseCap:true, retryOnce:false, responseProjectionJson:{fields:['plans']} };

test('large valid JSON is projected before the guest output budget is applied', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ padding:'x'.repeat(1800), plans:[{name:'Free', price:0}] });
    const result = await executeHttpAction(options);
    assert.equal(result.status,'OK');
    assert.deepEqual(JSON.parse(result.bodyText),{plans:[{name:'Free',price:0}]});
    assert.ok(result.bodyText.length<=MAX_GUEST_RESPONSE_CHARS);
    assert.equal(result.truncated,false);
  } finally { globalThis.fetch=original; }
});

test('redaction and schema validation precede output truncation, while the cap remains enforced', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ plans:[{name:'Plan',password:'PRIVATE_MARKER',description:'x'.repeat(2000)}] });
    const result = await executeHttpAction({...options,outputSchemaJson:{type:'object',required:['plans']}});
    assert.equal(result.status,'OK');
    assert.equal(result.truncated,true);
    assert.ok(result.bodyText.length<=MAX_GUEST_RESPONSE_CHARS);
    assert.ok(!result.bodyText.includes('PRIVATE_MARKER'));
  } finally { globalThis.fetch=original; }
});

test('malformed JSON and non-JSON success bodies still fail closed', async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [new Response('<html>test</html>',{headers:{'content-type':'text/html'}}),new Response('{broken',{headers:{'content-type':'application/json'}})]) {
      globalThis.fetch = async () => response;
      assert.equal((await executeHttpAction(options)).errorCode,'CONTENT_TYPE_INVALID');
    }
  } finally { globalThis.fetch=original; }
});

test('oversized upstream stream is cancelled instead of accumulated without bounds', async () => {
  const original = globalThis.fetch;
  let cancelled=false;
  try {
    globalThis.fetch = async () => new Response(new ReadableStream({
      start(c) { c.enqueue(new Uint8Array(1_048_577)); }, cancel(){cancelled=true;},
    }),{headers:{'content-type':'application/json'}});
    const result=await executeHttpAction(options);
    assert.equal(result.errorCode,'RESPONSE_TOO_LARGE');
    assert.equal(cancelled,true);
  } finally { globalThis.fetch=original; }
});

test('schema mismatches still reject valid JSON before returning any projected data', async () => {
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>Response.json({plans:123,padding:'x'.repeat(1800)});
    const result=await executeHttpAction({...options,outputSchemaJson:{plans:'array'}});
    assert.equal(result.errorCode,'OUTPUT_SCHEMA_INVALID');
  } finally {globalThis.fetch=original;}
});
