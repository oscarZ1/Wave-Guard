// SHA-256 via Web Crypto (available in the service worker and in Node 22).
import { canonicalizeUrl, hostnameOf, registrableDomain } from './normalize.js';

// Only the first 4 bytes (8 hex chars) of a hash ever leave the browser during checks.
export const PREFIX_HEX_LENGTH = 8;
export const PREFIX_PATTERN = /^[0-9a-f]{8}$/;

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function prefixOf(hash) {
  return hash.slice(0, PREFIX_HEX_LENGTH);
}

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function hashEmail(email) {
  return sha256Hex(normalizeEmail(email));
}

// → { canonical, domain, urlHash, domainHash } or null for non-http(s) URLs.
export async function hashesForUrl(input) {
  const canonical = canonicalizeUrl(input);
  if (!canonical) return null;
  const domain = registrableDomain(hostnameOf(input));
  const [urlHash, domainHash] = await Promise.all([sha256Hex(canonical), sha256Hex(domain)]);
  return { canonical, domain, urlHash, domainHash };
}
