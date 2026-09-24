// Domain registration date via RDAP (the modern WHOIS), cached in memory.
// rdap.org redirects each query to the registry that runs that top-level domain.
import { cleanHost, hostingPlatformOf, isPublicHost, registrableDomain } from '../../../extension/src/lib/index.js';

const DAY_MS = 86_400_000;
const TTL_FOUND_MS = DAY_MS;
const TTL_FAILED_MS = 60 * 60 * 1000;
const cache = new Map(); // domain → { value, expires } (server-side state is fine)

export function parseRegistration(rdap) {
  const event = (rdap?.events ?? []).find((e) => e?.eventAction === 'registration');
  const date = event ? new Date(event.eventDate) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

// → { domain, status: 'ok', registered, age_days }
//   | { domain, status: 'local' | 'unknown' | 'unavailable' }
//   | { domain, status: 'hosted', platform }
export async function getDomainInfo(host, { fetchImpl = fetch, now = Date.now() } = {}) {
  const h = cleanHost(host);
  if (!isPublicHost(h)) return { domain: h, status: 'local' };
  const platform = hostingPlatformOf(h);
  const domain = registrableDomain(h);
  if (platform) return { domain, status: 'hosted', platform };

  let entry = cache.get(domain);
  if (!entry || entry.expires <= now) {
    entry = await lookup(domain, fetchImpl, now);
    cache.set(domain, entry);
  }
  const { value } = entry;
  return value.registered
    ? { domain, status: 'ok', registered: value.registered, age_days: Math.max(0, Math.floor((now - Date.parse(value.registered)) / DAY_MS)) }
    : { domain, status: value.status };
}

async function lookup(domain, fetchImpl, now) {
  try {
    const res = await fetchImpl(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      // rdap.org rejects Node's default user agent with a 403, so identify ourselves.
      headers: {
        accept: 'application/rdap+json, application/json',
        'user-agent': 'WaveGuard/0.1 (campus phishing-defense hackathon project)',
      },
      signal: AbortSignal.timeout(6000),
    });
    // 404: rdap.org has no record, often because the registry (e.g. .edu) doesn't publish RDAP.
    if (res.status === 404) return { value: { status: 'unknown' }, expires: now + TTL_FOUND_MS };
    if (!res.ok) throw new Error(`RDAP responded ${res.status}`);
    const registered = parseRegistration(await res.json());
    return { value: registered ? { registered } : { status: 'unknown' }, expires: now + TTL_FOUND_MS };
  } catch {
    return { value: { status: 'unavailable' }, expires: now + TTL_FAILED_MS };
  }
}

export function clearDomainCache() {
  cache.clear();
}
