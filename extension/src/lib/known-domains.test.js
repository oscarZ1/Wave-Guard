import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_KNOWN_DOMAINS, isKnownDomain } from './known-domains.js';

test('isKnownDomain accepts known domains and their subdomains only', () => {
  assert.ok(isKnownDomain('pepperdine.edu'));
  assert.ok(isKnownDomain('www.pepperdine.edu'));
  assert.ok(isKnownDomain('PEPPERDINE.EDU.'));
  assert.ok(!isKnownDomain('pepperdine.edu.evil.com'));
  assert.ok(!isKnownDomain('notpepperdine.edu'));
  assert.ok(!isKnownDomain(null));
});

test('bundled allowlist matches the server seed data', async () => {
  const seed = await readFile(new URL('../../../server/src/db/seed.sql', import.meta.url), 'utf8');
  const section = seed.slice(seed.indexOf('INSERT INTO known_domains'));
  const seeded = [...section.matchAll(/\(\s*'([a-z0-9.-]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...seeded].sort(), [...DEFAULT_KNOWN_DOMAINS].sort());
});
