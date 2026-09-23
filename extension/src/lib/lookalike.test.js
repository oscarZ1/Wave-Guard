import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLookalike } from './lookalike.js';

const puny = (host) => new URL(`http://${host}`).hostname;

test('flags look-alike characters as high', () => {
  for (const host of ['pepperdlne.edu', 'pepperd1ne.edu', 'login.pepperdlne.edu', 'g00gle.com', 'rnicrosoft.com', 'zoorn.us']) {
    const r = checkLookalike(host);
    assert.equal(r.triggered, true, host);
    assert.equal(r.severity, 'high', host);
  }
});

test('flags another-alphabet (punycode) domains and names the real one', () => {
  const r = checkLookalike(puny('pepperdіne.edu')); // Cyrillic і
  assert.equal(r.triggered, true);
  assert.equal(r.severity, 'high');
  assert.match(r.reason, /another alphabet/);
  assert.match(r.reason, /pepperdine\.edu/);
});

test('flags small misspellings of long names', () => {
  assert.equal(checkLookalike('peperdine.edu').severity, 'high'); // 1 edit
  assert.equal(checkLookalike('pepperdien.com').severity, 'medium'); // 2 edits
  assert.equal(checkLookalike('instructur.com').triggered, true);
});

test('does not flag the real domains or their subdomains', () => {
  for (const host of ['pepperdine.edu', 'www.pepperdine.edu', 'courses.instructure.com', 'zoom.us', 'google.com']) {
    assert.equal(checkLookalike(host).triggered, false, host);
  }
});

test('does not flag unrelated sites that are near short names', () => {
  for (const host of ['meta.com', 'ikea.com', 'data.com', 'notice.com', 'wikipedia.org', 'github.com', 'boom.us']) {
    assert.equal(checkLookalike(host).triggered, false, host);
  }
});

test('ignores localhost, IPs and empty input', () => {
  for (const host of ['localhost', '127.0.0.1', '', null]) {
    assert.equal(checkLookalike(host).triggered, false, String(host));
  }
});

test('respects a custom known-domains list', () => {
  assert.equal(checkLookalike('pepperdlne.edu', ['example.org']).triggered, false);
});
