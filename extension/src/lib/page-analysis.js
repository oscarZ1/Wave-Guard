// Verdict for the page the user is on, from local heuristics only (nothing leaves the browser).
import { SEVERITY_RANK } from './result.js';
import { checkBrandInWrongPlace } from './brand.js';
import { checkLookalike } from './lookalike.js';
import { hostnameOf } from './normalize.js';
import { DEFAULT_KNOWN_DOMAINS } from './known-domains.js';

// → { verdict: 'danger' | 'caution' | 'safe', findings: [{ kind, severity, reason }] }
export function analyzePage(url, knownDomains = DEFAULT_KNOWN_DOMAINS) {
  const host = hostnameOf(url);
  if (!host) return { verdict: 'safe', findings: [] };
  const findings = [];
  const brand = checkBrandInWrongPlace(url, knownDomains);
  if (brand.triggered) findings.push({ kind: 'brand', severity: brand.severity, reason: brand.reason });
  const look = checkLookalike(host, knownDomains);
  if (look.triggered) findings.push({ kind: 'lookalike', severity: look.severity, reason: look.reason });
  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const verdict = findings.some((f) => f.severity === 'high') ? 'danger' : findings.length ? 'caution' : 'safe';
  return { verdict, findings };
}
