import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSenderImpersonation, nameMatches } from './sender.js';

const rivera = {
  name: 'Alex Rivera',
  title: 'Dean of Students',
  official_emails: ['alex.rivera@pepperdine.edu', 'deanofstudents@pepperdine.edu'],
  verify_channel: 'Office line (310) 555-0142',
};

test('Dean Alex Rivera from gmail.com is high and explains why', () => {
  const r = checkSenderImpersonation({ displayName: 'Dean Alex Rivera', email: 'dean.alex.rivera.office@gmail.com' }, rivera);
  assert.equal(r.triggered, true);
  assert.equal(r.severity, 'high');
  assert.match(r.reason, /personal gmail\.com/);
  assert.match(r.reason, /alex\.rivera@pepperdine\.edu/);
});

test('a look-alike domain sender is high', () => {
  const r = checkSenderImpersonation({ displayName: 'Alex Rivera', email: 'alex@pepperdlne.edu' }, rivera);
  assert.equal(r.severity, 'high');
  assert.match(r.reason, /pepperdlne\.edu/);
});

test('an unofficial campus address is medium', () => {
  const r = checkSenderImpersonation({ displayName: 'Alex Rivera', email: 'arivera@pepperdine.edu' }, rivera);
  assert.equal(r.severity, 'medium');
});

test('an official address is not flagged, in any letter case', () => {
  assert.equal(checkSenderImpersonation({ displayName: 'Dean Alex Rivera', email: 'ALEX.RIVERA@pepperdine.edu' }, rivera).triggered, false);
  assert.equal(checkSenderImpersonation({ displayName: 'Office of the Dean', email: 'deanofstudents@pepperdine.edu' }, rivera).triggered, false);
});

test('no directory match or a different name is not flagged', () => {
  assert.equal(checkSenderImpersonation({ displayName: 'Alexandra Rivers', email: 'x@gmail.com' }, rivera).triggered, false);
  assert.equal(checkSenderImpersonation({ displayName: 'Dean Alex Rivera', email: 'x@gmail.com' }, null).triggered, false);
  assert.equal(checkSenderImpersonation({ displayName: '', email: 'x@gmail.com' }, rivera).triggered, false);
});

test('nameMatches needs whole words', () => {
  assert.ok(nameMatches('Dean Alex Rivera', 'Alex Rivera'));
  assert.ok(nameMatches('Pepperdine IT Security', 'IT Security'));
  assert.ok(!nameMatches('Alex Riveras', 'Alex Rivera'));
  assert.ok(!nameMatches('Kalex Rivera', 'Alex Rivera'));
});
