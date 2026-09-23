// Report triage: decides whether a report warns every WaveGuard user right away or
// waits in the IT dashboard. Without it, one report (or one person spamming the
// Report button) would put a warning on everyone's screen.
//
//   WaveGuard's own checks agree it's phishing (high-severity finding) → warn everyone now
//   2+ credible reporters                                             → warn everyone
//   anything else                                                     → pending (only IT sees it)
//   3+ credible reporters, IT confirm / dismiss                        → unchanged, see status.js
//
// Corroborated reports can share instantly because they can't be abused: an ordinary
// website never trips a high-severity check, so spam can only ever reach IT.
// A reporter stops counting as credible once IT has dismissed several of their
// reports (more dismissed than confirmed); their reports still reach IT.
// Each reporter can send a limited number of reports per hour.
import {
  analyzePage, checkBrandInWrongPlace, checkLookalike, checkSenderImpersonation, nameMatches,
} from '../../../extension/src/lib/index.js';
import { computeStatus } from './status.js';

export const TRIAGE_DEFAULTS = Object.freeze({
  shareAfterReporters: 2,
  reportsPerHour: 10,
  muteAfterDismissed: 3,
});

function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
}

// Thresholds can be tuned in server/.env. WAVEGUARD_SHARE_AFTER_REPORTERS=1 restores
// the original "one report warns everyone" behavior.
export function triageConfig(env = process.env) {
  return {
    shareAfterReporters: positiveInt(env.WAVEGUARD_SHARE_AFTER_REPORTERS, TRIAGE_DEFAULTS.shareAfterReporters),
    reportsPerHour: positiveInt(env.WAVEGUARD_REPORTS_PER_HOUR, TRIAGE_DEFAULTS.reportsPerHour),
    muteAfterDismissed: positiveInt(env.WAVEGUARD_MUTE_AFTER_DISMISSED, TRIAGE_DEFAULTS.muteAfterDismissed),
  };
}

// reportsInLastHour is counted before the new report is saved.
export function overReportLimit(reportsInLastHour, config = TRIAGE_DEFAULTS) {
  return reportsInLastHour >= config.reportsPerHour;
}

// history: this reporter's past reports that ended up blocked (confirmed) or dismissed by IT.
export function isMuted({ confirmed = 0, dismissed = 0 } = {}, config = TRIAGE_DEFAULTS) {
  return dismissed >= config.muteAfterDismissed && dismissed > confirmed;
}

const strongestReason = (results) => results.find((r) => r?.triggered && r.severity === 'high')?.reason ?? null;

// → the reason WaveGuard's own checks flag this URL as phishing, or null.
export function corroborateUrl(url, knownDomains) {
  if (!url) return null;
  return analyzePage(url, knownDomains).findings.find((f) => f.severity === 'high')?.reason ?? null;
}

// Longest directory name inside the display name wins ("Dean Alex Rivera" → Alex Rivera).
export function directoryMatch(displayName, directory = []) {
  return directory
    .filter((entry) => nameMatches(displayName, entry.name))
    .sort((a, b) => b.name.length - a.name.length)[0] ?? null;
}

// → the reason WaveGuard's own checks flag this sender as phishing, or null.
export function corroborateSender({ email, displayName } = {}, { directory = [], knownDomains } = {}) {
  const address = String(email ?? '').trim().toLowerCase();
  const domain = address.split('@')[1];
  if (!domain) return null;
  return strongestReason([
    checkSenderImpersonation({ displayName, email: address }, directoryMatch(displayName, directory)),
    checkLookalike(domain, knownDomains),
    checkBrandInWrongPlace(`http://${domain}/`, knownDomains),
  ]);
}

// → { status: 'pending' | 'warn' | 'block' | 'dismissed', note }
// note is one plain-language line for the IT dashboard; null means keep the current note.
export function triageEntry({ current, credibleReporters, isKnownDomain, corroboration = null, config = TRIAGE_DEFAULTS }) {
  const enoughReporters = credibleReporters >= config.shareAfterReporters;
  const status = computeStatus({
    current,
    distinctReporters: credibleReporters,
    isKnownDomain,
    shareWithCommunity: Boolean(corroboration) || enoughReporters,
  });
  return { status, note: noteFor({ current, status, credibleReporters, corroboration, enoughReporters, config }) };
}

function noteFor({ current, status, credibleReporters, corroboration, enoughReporters, config }) {
  if (current === 'block' || current === 'dismissed') return null; // an earlier decision stands
  if (status === 'block') return `Blocked automatically: ${credibleReporters} people reported it.`;
  if (status === 'warn') {
    if (corroboration) return `Warning everyone. WaveGuard's own checks agree: ${corroboration}`;
    if (enoughReporters) return `Warning everyone: ${credibleReporters} people reported it.`;
    return null; // shared earlier, keep the reason it was shared
  }
  if (credibleReporters === 0) return 'Held for review: IT dismissed most earlier reports from the people who reported this.';
  const reports = credibleReporters === 1 ? '1 report' : `${credibleReporters} reports`;
  return `Held for review: ${reports} so far and no warning signs found. Everyone is warned after ${config.shareAfterReporters} reports or when you choose Warn everyone.`;
}
