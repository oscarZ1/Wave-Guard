// All persistent extension state lives in chrome.storage (the worker itself is stateless).
import { DEFAULT_KNOWN_DOMAINS } from '../lib/known-domains.js';
import { api } from './api.js';

const KNOWN_DOMAINS_TTL_MS = 6 * 60 * 60 * 1000;
const ALLOW_TTL_MS = 10 * 60 * 1000;
const REPORTER_PATTERN = /^[^\s@<>]+@pepperdine\.edu$/;

// ---- Mock identity (production would use Google Workspace SSO) ----
export async function getReporterId() {
  const { reporterId } = await chrome.storage.local.get('reporterId');
  if (reporterId) return reporterId;
  const generated = `student-${Math.floor(1000 + Math.random() * 9000)}@pepperdine.edu`;
  await chrome.storage.local.set({ reporterId: generated });
  return generated;
}

export async function setReporterId(value) {
  const id = String(value ?? '').trim().toLowerCase();
  if (!REPORTER_PATTERN.test(id) || id.length > 200) throw new Error('Use your pepperdine.edu email address.');
  await chrome.storage.local.set({ reporterId: id });
  return id;
}

// ---- Known-domains allowlist cache ----
export async function refreshKnownDomains() {
  const { domains } = await api('/api/known-domains', { timeoutMs: 3000 });
  const list = domains.map((d) => d.domain);
  await chrome.storage.local.set({ knownDomains: list, knownDomainsAt: Date.now() });
  return list;
}

export async function getKnownDomains() {
  const { knownDomains, knownDomainsAt } = await chrome.storage.local.get(['knownDomains', 'knownDomainsAt']);
  if (!knownDomains?.length || Date.now() - (knownDomainsAt ?? 0) > KNOWN_DOMAINS_TTL_MS) {
    refreshKnownDomains().catch(() => {});
  }
  return knownDomains?.length ? knownDomains : DEFAULT_KNOWN_DOMAINS;
}

// ---- "Continue anyway": the tab may load this one URL until it navigates elsewhere ----
const allowKey = (tabId) => `allow:${tabId}`;

export async function allowOnce(tabId, canonical) {
  await chrome.storage.session.set({ [allowKey(tabId)]: { canonical, until: Date.now() + ALLOW_TTL_MS } });
}

export async function isAllowed(tabId, canonical, { clearIfDifferent = false } = {}) {
  const key = allowKey(tabId);
  const { [key]: entry } = await chrome.storage.session.get(key);
  if (!entry) return false;
  if (entry.canonical === canonical && entry.until > Date.now()) return true;
  if (clearIfDifferent) await chrome.storage.session.remove(key);
  return false;
}

export function clearAllow(tabId) {
  return chrome.storage.session.remove(allowKey(tabId));
}
