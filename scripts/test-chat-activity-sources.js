import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dedupeSources, parseWebSearchResponse } from '../lib/services/ai/web-search-result.js';

test('later citation supplies the title lost by first-source dedupe', () => {
  const result = parseWebSearchResponse({ output: [
    { type: 'web_search_call', action: { sources: [{ url: 'https://example.com/Guide' }] } },
    { type: 'message', content: [{ type: 'output_text', text: 'Guide', annotations: [
      { type: 'url_citation', url: 'https://example.com/Guide', title: 'AIDE installation guide', start_index: 0, end_index: 5 },
    ] }] },
  ] });
  assert.equal(result.sources[0].title, 'AIDE installation guide');
});

test('source titles merge in both orders and missing titles use hostname', () => {
  const named = { url: 'https://example.com/Guide', title: 'Installation guide' };
  const unnamed = { url: named.url, title: 'Untitled source' };
  for (const values of [[named, unnamed], [unnamed, named]]) {
    assert.deepEqual(dedupeSources(values), [named]);
  }
  assert.equal(dedupeSources([{ url: named.url }])[0].title, 'example.com');
  assert.equal(dedupeSources([{ url: named.url, title: 'example.com' }, named])[0].title, named.title);
});

test('URL identity preserves case-sensitive paths/queries and collapses fragments', () => {
  assert.equal(dedupeSources([
    { url: 'https://EXAMPLE.com/Guide?a=A#one' },
    { url: 'https://example.com/Guide?a=A#two' },
    { url: 'https://example.com/guide?a=A' },
    { url: 'https://example.com/Guide?a=a' },
  ]).length, 3);
});

test('unsafe, credential-bearing, overlong and malformed URLs are rejected', () => {
  const urls = ['javascript:alert(1)', 'data:text/html,hello', 'https://user:password@example.com/', 'not a URL', 'https://example.com/' + 'a'.repeat(2100), null];
  assert.deepEqual(dedupeSources(urls.map(url => ({ url }))), []);
});

test('untrusted title is bounded text with control characters removed', () => {
  const title = '<img src=x onerror=alert(1)>\u202E' + 'a'.repeat(300);
  const [source] = dedupeSources([{ url: 'https://example.com', title }]);
  assert.ok(source.title.length <= 240);
  assert.ok(!source.title.includes('\u202E'));
  assert.equal(typeof source.title, 'string');
  assert.deepEqual(Object.keys(source).sort(), ['title', 'url']);
});
