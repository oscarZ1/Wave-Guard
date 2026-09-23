// Bundled fallback allowlist, used until the extension has fetched the server's
// list. Keep in sync with server/src/db/seed.sql (a test enforces this).
import { cleanHost } from './normalize.js';

export const DEFAULT_KNOWN_DOMAINS = [
  'pepperdine.edu',
  'pepperdinewaves.com',
  'okta.com',
  'instructure.com',
  'zoom.us',
  'google.com',
  'microsoft.com',
  'office.com',
];

// Home domains of the organization itself (used for sender checks and wording).
export const ORG_DOMAINS = ['pepperdine.edu'];

// True if host is a known domain or any subdomain of one.
export function isKnownDomain(host, knownDomains = DEFAULT_KNOWN_DOMAINS) {
  if (!host) return false;
  const h = cleanHost(host);
  return knownDomains.some((d) => h === d || h.endsWith(`.${d}`));
}
