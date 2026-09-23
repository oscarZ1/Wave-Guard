import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateReport, validateCheck, validateEvent } from './validate.js';

test('validateReport accepts a URL report and normalizes emails', () => {
  const { value, error } = validateReport({ reporter_id: ' Student@Pepperdine.edu ', url: 'http://evil.test/login' });
  assert.equal(error, undefined);
  assert.equal(value.reporter_id, 'student@pepperdine.edu');
  assert.equal(value.url, 'http://evil.test/login');
});

test('validateReport accepts a sender-only report and trims long excerpts', () => {
  const { value } = validateReport({
    reporter_id: 'a@pepperdine.edu', sender_email: 'Dean@Gmail.com', sender_display_name: 'Dean Alex Rivera', excerpt: 'x'.repeat(900),
  });
  assert.equal(value.sender_email, 'dean@gmail.com');
  assert.equal(value.excerpt.length, 500);
  assert.equal(value.url, null);
});

test('validateReport rejects bad input', () => {
  assert.ok(validateReport(null).error);
  assert.ok(validateReport({ url: 'http://x.test/' }).error, 'missing reporter');
  assert.ok(validateReport({ reporter_id: 'nope', url: 'http://x.test/' }).error, 'bad reporter');
  assert.ok(validateReport({ reporter_id: 'a@b.edu' }).error, 'no url or sender');
  assert.ok(validateReport({ reporter_id: 'a@b.edu', url: 'javascript:alert(1)' }).error, 'non-http url');
  assert.ok(validateReport({ reporter_id: 'a@b.edu', url: 42 }).error, 'non-string url');
  assert.ok(validateReport({ reporter_id: 'a@b.edu', sender_email: 'not-an-email' }).error, 'bad sender');
});

test('validateCheck accepts 8-hex prefixes only', () => {
  assert.deepEqual(validateCheck({ prefixes: ['0a1b2c3d', '0a1b2c3d', 'ffffffff'] }).value, ['0a1b2c3d', 'ffffffff']);
  assert.ok(validateCheck({ prefixes: [] }).error);
  assert.ok(validateCheck({ prefixes: ['0A1B2C3D'] }).error);
  assert.ok(validateCheck({ prefixes: ['0a1b2c3d4e'] }).error);
  assert.ok(validateCheck({ prefixes: Array(51).fill('0a1b2c3d') }).error);
  assert.ok(validateCheck({ prefixes: 'abc' }).error);
});

test('validateEvent accepts known types and optional hashes', () => {
  assert.deepEqual(validateEvent({ type: 'warned' }).value, { type: 'warned', hash: null });
  assert.equal(validateEvent({ type: 'continued', hash: 'a'.repeat(64) }).value.hash, 'a'.repeat(64));
  assert.ok(validateEvent({ type: 'clicked' }).error);
  assert.ok(validateEvent({ type: 'warned', hash: 'xyz' }).error);
});
