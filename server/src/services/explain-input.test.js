import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateExplain, sanitizeExcerpt, heuristicExplanation } from './explain-input.js';

test('sanitizeExcerpt keeps the sender, removes other emails, and reduces links to hosts', () => {
  const out = sanitizeExcerpt(
    'Reply to dean@gmail.com or cc jane.doe@pepperdine.edu. Sign in at https://pepperdine-sso-login.test:8082/?session=abc now.',
    'Dean@Gmail.com',
  );
  assert.match(out, /dean@gmail\.com/);
  assert.doesNotMatch(out, /jane\.doe/);
  assert.match(out, /\[email address removed\]/);
  assert.match(out, /\[link to pepperdine-sso-login\.test:8082\]/);
  assert.doesNotMatch(out, /session=abc/);
});

test('validateExplain accepts an email request and trims it down', () => {
  const { value, error } = validateExplain({
    kind: 'email',
    signals: [{ reason: 'Claims to be the Dean but sent from gmail.com', severity: 'high' }],
    sender_name: 'Dean Alex Rivera', sender_email: 'Dean.Alex.Rivera.Office@gmail.com',
    subject: 'Quick favor', excerpt: 'x'.repeat(900), link_hosts: ['EVIL.test', 'evil.test', 'bad host!'],
  });
  assert.equal(error, undefined);
  assert.equal(value.sender_email, 'dean.alex.rivera.office@gmail.com');
  assert.equal(value.excerpt.length, 500);
  assert.deepEqual(value.link_hosts, ['evil.test']);
});

test('validateExplain accepts a website request', () => {
  const { value } = validateExplain({ kind: 'website', site: 'pepperdine-sso-login.test', status: 'block', report_count: 3, signals: [{ reason: 'Confirmed phishing by IT' }] });
  assert.equal(value.status, 'block');
  assert.equal(value.signals[0].severity, 'medium');
});

test('validateExplain rejects bad input', () => {
  assert.ok(validateExplain(null).error);
  assert.ok(validateExplain({ kind: 'sms', signals: [{ reason: 'x' }] }).error);
  assert.ok(validateExplain({ kind: 'email', signals: [] }).error);
  assert.ok(validateExplain({ kind: 'email', signals: [{ severity: 'high' }] }).error);
  assert.ok(validateExplain({ kind: 'website', site: 'not a host/', signals: [{ reason: 'x' }] }).error);
  assert.ok(validateExplain({ kind: 'email', sender_email: 'nope', signals: [{ reason: 'x' }] }).error);
});

test('heuristicExplanation falls back to the WaveGuard reasons', () => {
  const r = heuristicExplanation({ kind: 'email', signals: [{ reason: 'A', severity: 'high' }, { reason: 'B', severity: 'low' }] });
  assert.equal(r.verdict, 'phishing');
  assert.deepEqual(r.red_flags.map((f) => f.text), ['A', 'B']);
  assert.ok(r.what_to_do.length > 20);
});
