// Lookalike domain: a name spelled almost like a known campus domain.
// Compares only the second-level label ("pepperdlne" in pepperdlne.edu) so short
// known names like okta.com don't flag unrelated sites like meta.com.
import { clean, flag } from './result.js';
import { cleanHost, isIpAddress, registrableDomain, secondLevelLabel } from './normalize.js';
import { decodeHost, hasNonAscii, skeleton } from './homoglyphs.js';
import { levenshtein } from './levenshtein.js';
import { DEFAULT_KNOWN_DOMAINS, isKnownDomain } from './known-domains.js';

// How many typos we tolerate grows with the length of the real name.
export function maxDistanceFor(label) {
  if (label.length >= 8) return 2;
  if (label.length >= 5) return 1;
  return 0;
}

export function checkLookalike(hostname, knownDomains = DEFAULT_KNOWN_DOMAINS) {
  if (!hostname) return clean();
  const host = cleanHost(hostname);
  if (host === 'localhost' || isIpAddress(host) || isKnownDomain(host, knownDomains)) return clean();

  const registrable = registrableDomain(host);
  const label = secondLevelLabel(registrable);
  const shown = decodeHost(registrable);
  const labelSkeleton = skeleton(label);

  let best = null;
  for (const known of knownDomains) {
    const knownLabel = secondLevelLabel(known);
    if (label === knownLabel) continue; // same name, other TLD: the brand check covers it
    const distance = levenshtein(labelSkeleton, skeleton(knownLabel));
    if (distance > maxDistanceFor(knownLabel)) continue;
    if (!best || distance < best.distance) best = { known, distance };
  }
  if (!best) return clean();

  if (hasNonAscii(decodeHost(label))) {
    return flag('high', `${shown} is disguised with letters from another alphabet to look like ${best.known}. It is not the real ${best.known}.`);
  }
  if (best.distance === 0) {
    return flag('high', `${shown} swaps look-alike characters to imitate ${best.known}. It is not the real ${best.known}.`);
  }
  const severity = best.distance === 1 ? 'high' : 'medium';
  return flag(severity, `${shown} is spelled almost like ${best.known}, but it is a different website.`);
}
