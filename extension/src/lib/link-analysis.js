// Risk reasons for a single link: used by the hover tooltip and the inbox analysis.
// Pure: the caller passes the herd-immunity status it looked up (via hash prefixes).
import { SEVERITY_RANK } from './result.js';
import { checkLinkMismatch } from './link-mismatch.js';
import { checkBrandInWrongPlace } from './brand.js';
import { checkLookalike } from './lookalike.js';
import { hostnameOf } from './normalize.js';
import { decodeHost } from './homoglyphs.js';
import { DEFAULT_KNOWN_DOMAINS, isKnownDomain } from './known-domains.js';

const REPORTED_REASON = {
  warn: 'Another Pepperdine user reported this link as phishing.',
  block: 'Pepperdine IT confirmed this link is phishing.',
};

// link: { text, href }; context: { knownDomains, status: 'clean' | 'warn' | 'block' | ... }
// → { host, official, findings: [{ kind, severity, reason }], verdict } or null for non-web links
export function analyzeLink(link, { knownDomains = DEFAULT_KNOWN_DOMAINS, status = null } = {}) {
  const hostname = hostnameOf(link?.href);
  if (!hostname) return null;
  const findings = [];
  const add = (kind, result) => {
    if (result.triggered) findings.push({ kind, severity: result.severity, reason: result.reason });
  };
  add('link-mismatch', checkLinkMismatch(link.text, link.href));
  const brand = checkBrandInWrongPlace(link.href, knownDomains);
  add('link-brand', brand);
  if (!brand.triggered) add('link-lookalike', checkLookalike(hostname, knownDomains));
  if (status === 'warn' || status === 'block') {
    findings.push({ kind: 'reported-link', severity: 'high', reason: REPORTED_REASON[status] });
  }
  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  return {
    host: decodeHost(hostname),
    official: isKnownDomain(hostname, knownDomains),
    findings,
    verdict: findings.some((f) => f.severity === 'high') ? 'danger' : findings.length ? 'caution' : 'safe',
  };
}
