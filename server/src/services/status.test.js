import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStatus, statusForDecision } from './status.js';

test('one reporter gives a soft warning', () => {
  assert.equal(computeStatus({ current: undefined, distinctReporters: 1, isKnownDomain: false }), 'warn');
});

test('three distinct reporters escalate to block', () => {
  assert.equal(computeStatus({ current: 'warn', distinctReporters: 2, isKnownDomain: false }), 'warn');
  assert.equal(computeStatus({ current: 'warn', distinctReporters: 3, isKnownDomain: false }), 'block');
});

test('allowlisted domains are never auto-blocked', () => {
  assert.equal(computeStatus({ current: 'warn', distinctReporters: 50, isKnownDomain: true }), 'warn');
});

test('IT decisions stick', () => {
  assert.equal(computeStatus({ current: 'dismissed', distinctReporters: 10, isKnownDomain: false }), 'dismissed');
  assert.equal(computeStatus({ current: 'block', distinctReporters: 1, isKnownDomain: true }), 'block');
});

test('IT actions map to statuses', () => {
  assert.equal(statusForDecision('confirm'), 'block');
  assert.equal(statusForDecision('dismiss'), 'dismissed');
  assert.equal(statusForDecision('delete'), null);
});

test('held-back reports stay pending until shared', () => {
  assert.equal(computeStatus({ current: undefined, distinctReporters: 1, isKnownDomain: false, shareWithCommunity: false }), 'pending');
  assert.equal(computeStatus({ current: 'pending', distinctReporters: 2, isKnownDomain: false, shareWithCommunity: true }), 'warn');
});

test('a shared entry is never pulled back to pending', () => {
  assert.equal(computeStatus({ current: 'warn', distinctReporters: 1, isKnownDomain: false, shareWithCommunity: false }), 'warn');
});

test('three reporters still block, even while held back', () => {
  assert.equal(computeStatus({ current: 'pending', distinctReporters: 3, isKnownDomain: false, shareWithCommunity: false }), 'block');
});

test('IT can share a held-back entry', () => {
  assert.equal(statusForDecision('share'), 'warn');
});
