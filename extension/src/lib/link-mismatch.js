// Link mismatch: the visible text is a web address, but the link goes somewhere else.
import { clean, flag } from './result.js';
import { hostnameOf, registrableDomain } from './normalize.js';
import { decodeHost } from './homoglyphs.js';

// TLDs we accept for bare text like "pepperdine.edu" (avoids treating "report.pdf" as a site).
const COMMON_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'io', 'co', 'us', 'uk', 'ca', 'info', 'biz',
  'app', 'dev', 'me', 'ly', 'ai', 'site', 'online', 'xyz', 'link', 'test', 'localhost',
]);

const DOMAIN_TEXT = /^(https?:\/\/)?(www\.)?((?:[\p{L}\p{N}-]+\.)+([\p{L}]{2,}))(:\d+)?([/?#]\S*)?$/iu;

// Returns the hostname shown in link text, or null if the text isn't an address.
export function domainFromLinkText(text) {
  const t = String(text ?? '').trim().replace(/^[<("'\s]+|[>)"'\s.,]+$/g, '');
  const m = DOMAIN_TEXT.exec(t);
  if (!m) return null;
  const [, scheme, www, host, tld] = m;
  if (!scheme && !www && !COMMON_TLDS.has(tld.toLowerCase())) return null;
  return `${www ?? ''}${host}`.toLowerCase();
}

export function checkLinkMismatch(text, href) {
  const shownHost = domainFromLinkText(text);
  const realHost = hostnameOf(href);
  if (!shownHost || !realHost) return clean();

  const shown = registrableDomain(shownHost);
  const real = registrableDomain(realHost);
  if (shown === real) return clean();

  return flag('high', `This link says it goes to ${decodeHost(shownHost)}, but it actually opens ${decodeHost(realHost)}.`);
}
