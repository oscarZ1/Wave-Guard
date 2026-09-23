// Brand in the wrong place: "pepperdine" in the address of a site that isn't Pepperdine's,
// e.g. pepperdine.edu.secure-login.com or pepperdine-sso-login.test.
import { clean, flag } from './result.js';
import { parseHttpUrl, cleanHost, registrableDomain, subdomainPart } from './normalize.js';
import { decodeHost, skeleton } from './homoglyphs.js';
import { DEFAULT_KNOWN_DOMAINS, isKnownDomain } from './known-domains.js';

export const DEFAULT_BRANDS = ['pepperdine'];

const CREDENTIAL_WORDS = /log-?in|sign-?in|sso|verify|verification|password|passwd|account|secure|auth|mfa|duo|webmail|portal|reset|update/;

export function checkBrandInWrongPlace(input, knownDomains = DEFAULT_KNOWN_DOMAINS, brands = DEFAULT_BRANDS) {
  const url = parseHttpUrl(input);
  if (!url) return clean();
  const host = cleanHost(url.hostname);
  if (isKnownDomain(host, knownDomains)) return clean();

  const registrable = registrableDomain(host);
  const shownSite = decodeHost(registrable);
  let rawPath = url.pathname + url.search;
  try { rawPath = decodeURIComponent(rawPath); } catch { /* keep raw */ }
  rawPath = rawPath.toLowerCase();
  const pathText = skeleton(rawPath);
  // Match credential words on the raw text: the skeleton turns "login" into "logln".
  const credentialHint = CREDENTIAL_WORDS.test(decodeHost(host)) || CREDENTIAL_WORDS.test(rawPath);

  for (const brand of brands) {
    const b = skeleton(brand);
    const Brand = brand[0].toUpperCase() + brand.slice(1);

    if (skeleton(subdomainPart(host)).includes(b)) {
      return flag('high', `This address starts with "${Brand}", but the site really belongs to ${shownSite}, which is not a ${Brand} website.`);
    }
    if (skeleton(registrable).includes(b)) {
      return credentialHint
        ? flag('high', `${shownSite} uses the ${Brand} name and asks you to sign in, but it is not an official ${Brand} website.`)
        : flag('medium', `${shownSite} uses the ${Brand} name, but it is not an official ${Brand} website.`);
    }
    if (pathText.includes(b) && credentialHint) {
      return flag('medium', `This page mentions ${Brand} and signing in, but it is hosted on ${shownSite}, not on a ${Brand} website.`);
    }
  }
  return clean();
}
