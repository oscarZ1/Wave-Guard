// Herd-immunity check: send only 4-byte hash prefixes, compare full hashes locally.
import { hashesForUrl, prefixOf } from '../lib/hash.js';
import { api } from './api.js';

const RANK = { clean: 0, warn: 1, block: 2 };
const MAX_PREFIXES_PER_REQUEST = 50;

// Full hashes in → Map(fullHash → { hash, kind, status, report_count }) for real matches.
// Throws if the server can't be reached; callers decide whether to fail open.
export async function lookupHashes(hashes) {
  const wanted = new Set(hashes.filter(Boolean));
  const prefixes = [...new Set([...wanted].map(prefixOf))];
  const found = new Map();
  for (let i = 0; i < prefixes.length; i += MAX_PREFIXES_PER_REQUEST) {
    const body = { prefixes: prefixes.slice(i, i + MAX_PREFIXES_PER_REQUEST) };
    const { matches } = await api('/api/check', { method: 'POST', body });
    for (const m of matches) if (wanted.has(m.hash)) found.set(m.hash, m); // ignore prefix collisions
  }
  return found;
}

// Most severe of several matches → 'clean' | 'warn' | 'block'.
export function worstStatus(matches) {
  return matches.reduce((worst, m) => ((RANK[m?.status] ?? 0) > RANK[worst] ? m.status : worst), 'clean');
}

// → { status: 'clean' | 'warn' | 'block' | 'unknown', canonical, hash?, kind?, reportCount? }
export async function checkUrl(url) {
  const h = await hashesForUrl(url);
  if (!h) return { status: 'clean' };

  let found;
  try {
    found = await lookupHashes([h.urlHash, h.domainHash]);
  } catch (err) {
    return { status: 'unknown', canonical: h.canonical, error: err.message }; // fail open
  }

  const matches = [found.get(h.urlHash), found.get(h.domainHash)].filter(Boolean);
  const status = worstStatus(matches);
  if (status === 'clean') return { status, canonical: h.canonical };
  const top = matches.find((m) => m.status === status);
  const reportCount = Math.max(...matches.map((m) => m.report_count ?? 0));
  return { status, canonical: h.canonical, hash: top.hash, kind: top.kind, reportCount };
}

export function warningPageUrl({ url, status, back }) {
  const params = new URLSearchParams({ url, status });
  if (back) params.set('back', back);
  return `${chrome.runtime.getURL('src/pages/warning.html')}?${params}`;
}
