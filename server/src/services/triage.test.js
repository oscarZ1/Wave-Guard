import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRIAGE_DEFAULTS, corroborateSender, corroborateUrl, directoryMatch, isMuted, overReportLimit, triageConfig, triageEntry,
} from './triage.js';

const DIRECTORY = [
  { name: 'Alex Rivera', title: 'Dean of Students', official_emails: ['alex.rivera@pepperdine.edu'] },
  { name: 'IT Security', title: 'Information Security Office', official_emails: ['security@pepperdine.edu'] },
];

test('a single report of an ordinary-looking site is held for IT', () => {
  const { status, note } = triageEntry({ current: undefined, credibleReporters: 1, isKnownDomain: false });
  assert.equal(status, 'pending');
  assert.match(note, /Held for review: 1 report so far/);
});

test('a second credible reporter shares it with everyone', () => {
  const { status, note } = triageEntry({ current: 'pending', credibleReporters: 2, isKnownDomain: false });
  assert.equal(status, 'warn');
  assert.equal(note, 'Warning everyone: 2 people reported it.');
});

test('one report shares right away when WaveGuard\'s own checks agree', () => {
  const corroboration = corroborateUrl('http://pepperdine-sso-login.test:8082/login');
  assert.ok(corroboration, 'the fake SSO page should trip the brand check');
  const { status, note } = triageEntry({ current: undefined, credibleReporters: 1, isKnownDomain: false, corroboration });
  assert.equal(status, 'warn');
  assert.match(note, /own checks agree/);
});

test('ordinary sites and allowlisted sites are never corroborated', () => {
  assert.equal(corroborateUrl('https://example.com/'), null);
  assert.equal(corroborateUrl('https://docs.google.com/forms/d/abc'), null);
  assert.equal(corroborateUrl('https://www.pepperdine.edu/login'), null);
  assert.equal(corroborateUrl(null), null);
});

test('three credible reporters still block', () => {
  assert.equal(triageEntry({ current: 'warn', credibleReporters: 3, isKnownDomain: false }).status, 'block');
});

test('IT decisions stand and keep their note', () => {
  assert.deepEqual(triageEntry({ current: 'dismissed', credibleReporters: 5, isKnownDomain: false }), { status: 'dismissed', note: null });
  assert.deepEqual(triageEntry({ current: 'block', credibleReporters: 1, isKnownDomain: false }), { status: 'block', note: null });
});

test('an entry IT already shared stays shared and keeps its note', () => {
  assert.deepEqual(triageEntry({ current: 'warn', credibleReporters: 1, isKnownDomain: false }), { status: 'warn', note: null });
});

test('reports only from muted reporters stay held', () => {
  const { status, note } = triageEntry({ current: undefined, credibleReporters: 0, isKnownDomain: false });
  assert.equal(status, 'pending');
  assert.match(note, /dismissed/);
});

test('reporters are muted after repeated dismissals, not after one mistake', () => {
  assert.equal(isMuted({ confirmed: 0, dismissed: 1 }), false);
  assert.equal(isMuted({ confirmed: 0, dismissed: 3 }), true);
  assert.equal(isMuted({ confirmed: 5, dismissed: 3 }), false);
  assert.equal(isMuted(undefined), false);
});

test('each reporter gets a limited number of reports per hour', () => {
  assert.equal(overReportLimit(TRIAGE_DEFAULTS.reportsPerHour - 1), false);
  assert.equal(overReportLimit(TRIAGE_DEFAULTS.reportsPerHour), true);
});

test('impersonation and lookalike senders are corroborated', () => {
  const dean = corroborateSender(
    { email: 'dean.alex.rivera.office@gmail.com', displayName: 'Dean Alex Rivera' },
    { directory: DIRECTORY },
  );
  assert.match(dean, /personal gmail\.com account/);
  assert.ok(corroborateSender({ email: 'it-security@pepperdlne.edu', displayName: 'Pepperdine IT Security' }, { directory: DIRECTORY }));
});

test('ordinary senders are not corroborated', () => {
  assert.equal(corroborateSender({ email: 'drive-shares-noreply@docs-share-verify.test', displayName: 'Google Drive' }, { directory: DIRECTORY }), null);
  assert.equal(corroborateSender({ email: 'alex.rivera@pepperdine.edu', displayName: 'Alex Rivera' }, { directory: DIRECTORY }), null);
  assert.equal(corroborateSender({}, { directory: DIRECTORY }), null);
});

test('the longest directory name wins', () => {
  const directory = [{ name: 'Rivera' }, { name: 'Alex Rivera' }];
  assert.equal(directoryMatch('Dean Alex Rivera', directory).name, 'Alex Rivera');
  assert.equal(directoryMatch('Someone Else', directory), null);
});

test('thresholds come from the environment, with safe fallbacks', () => {
  assert.deepEqual(triageConfig({}), { ...TRIAGE_DEFAULTS });
  assert.equal(triageConfig({ WAVEGUARD_SHARE_AFTER_REPORTERS: '1' }).shareAfterReporters, 1);
  assert.equal(triageConfig({ WAVEGUARD_REPORTS_PER_HOUR: '0' }).reportsPerHour, TRIAGE_DEFAULTS.reportsPerHour);
  assert.equal(triageConfig({ WAVEGUARD_MUTE_AFTER_DISMISSED: 'lots' }).muteAfterDismissed, TRIAGE_DEFAULTS.muteAfterDismissed);
});

test('share-after-1 restores the original behavior', () => {
  const config = triageConfig({ WAVEGUARD_SHARE_AFTER_REPORTERS: '1' });
  assert.equal(triageEntry({ current: undefined, credibleReporters: 1, isKnownDomain: false, config }).status, 'warn');
});
