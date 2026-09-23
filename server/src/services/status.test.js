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
