import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDomainInfo, parseRegistration, clearDomainCache } from './rdap.js';

const NOW = Date.parse('2026-09-23T12:00:00Z');
const jsonResponse = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

beforeEach(() => clearDomainCache());

test('parseRegistration reads the registration event', () => {
  assert.equal(parseRegistration({ events: [{ eventAction: 'expiration', eventDate: '2030-01-01T00:00:00Z' }, { eventAction: 'registration', eventDate: '1997-09-15T04:00:00Z' }] }), '1997-09-15T04:00:00.000Z');
  assert.equal(parseRegistration({ events: [] }), null);
  assert.equal(parseRegistration({ events: [{ eventAction: 'registration', eventDate: 'not a date' }] }), null);
  assert.equal(parseRegistration(null), null);
});

test('a registered domain returns its age, queried by registrable domain', async () => {
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return jsonResponse(200, { events: [{ eventAction: 'registration', eventDate: '2026-09-20T12:00:00Z' }] }); };
  const r = await getDomainInfo('login.brand-new-phish.com', { fetchImpl, now: NOW });
  assert.deepEqual(r, { domain: 'brand-new-phish.com', status: 'ok', registered: '2026-09-20T12:00:00.000Z', age_days: 3 });
  assert.deepEqual(calls, ['https://rdap.org/domain/brand-new-phish.com']);
});

test('results are cached per domain', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; return jsonResponse(200, { events: [{ eventAction: 'registration', eventDate: '1997-09-15T04:00:00Z' }] }); };
  await getDomainInfo('a.google.com', { fetchImpl, now: NOW });
  await getDomainInfo('www.google.com', { fetchImpl, now: NOW });
  assert.equal(n, 1);
});

test('404 is "unknown" and network failures are "unavailable"', async () => {
  assert.equal((await getDomainInfo('pepperdine.edu', { fetchImpl: async () => jsonResponse(404, {}), now: NOW })).status, 'unknown');
  assert.equal((await getDomainInfo('flaky.com', { fetchImpl: async () => { throw new Error('offline'); }, now: NOW })).status, 'unavailable');
  assert.equal((await getDomainInfo('broken.com', { fetchImpl: async () => jsonResponse(503, {}), now: NOW })).status, 'unavailable');
});

test('local and test addresses are never looked up; hosting platforms are named', async () => {
  const fetchImpl = async () => { throw new Error('should not be called'); };
  assert.equal((await getDomainInfo('pepperdine-sso-login.localhost', { fetchImpl })).status, 'local');
  assert.equal((await getDomainInfo('docs-share-verify.test', { fetchImpl })).status, 'local');
  assert.equal((await getDomainInfo('127.0.0.1', { fetchImpl })).status, 'local');
  assert.deepEqual(await getDomainInfo('pepperdine-login.github.io', { fetchImpl }), { domain: 'pepperdine-login.github.io', status: 'hosted', platform: 'github.io' });
});
