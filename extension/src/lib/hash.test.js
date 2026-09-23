import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex, prefixOf, hashesForUrl, hashEmail, PREFIX_PATTERN } from './hash.js';

test('sha256Hex matches a known vector', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('prefixOf returns the first 4 bytes as 8 hex chars', async () => {
  const p = prefixOf(await sha256Hex('abc'));
  assert.equal(p, 'ba7816bf');
  assert.match(p, PREFIX_PATTERN);
});

test('hashesForUrl hashes the canonical URL and registrable domain', async () => {
  const h = await hashesForUrl('https://Login.Evil.com/a#x');
  assert.equal(h.canonical, 'login.evil.com/a');
  assert.equal(h.domain, 'evil.com');
  assert.equal(h.urlHash, await sha256Hex('login.evil.com/a'));
  assert.equal(h.domainHash, await sha256Hex('evil.com'));
});

test('hashesForUrl is the same for http and https', async () => {
  const a = await hashesForUrl('http://evil.com/login');
  const b = await hashesForUrl('https://evil.com/login');
  assert.equal(a.urlHash, b.urlHash);
});

test('hashesForUrl returns null for non-web URLs', async () => {
  assert.equal(await hashesForUrl('javascript:alert(1)'), null);
});

test('hashEmail ignores case and whitespace', async () => {
  assert.equal(await hashEmail('  Dean@Gmail.com '), await hashEmail('dean@gmail.com'));
});
