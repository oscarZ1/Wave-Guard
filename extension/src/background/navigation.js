// Herd-immunity check: send only 4-byte hash prefixes, compare full hashes locally.
import { hashesForUrl, prefixOf } from '../lib/hash.js';
import { api } from './api.js';

const RANK = { clean: 0, warn: 1, block: 2 };

// → { status: 'clean' | 'warn' | 'block' | 'unknown', canonical, hash?, kind?, reportCount? }
export async function checkUrl(url) {
  const h = await hashesForUrl(url);
  if (!h) return { status: 'clean' };

  let matches;
  try {
    const prefixes = [...new Set([prefixOf(h.urlHash), prefixOf(h.domainHash)])];
    ({ matches } = await api('/api/check', { method: 'POST', body: { prefixes } }));
  } catch (err) {
    return { status: 'unknown', canonical: h.canonical, error: err.message }; // fail open
  }

  let best = { status: 'clean', canonical: h.canonical };
  for (const m of matches) {
    if (m.hash !== h.urlHash && m.hash !== h.domainHash) continue; // prefix collision, not a match
    const reportCount = Math.max(m.report_count ?? 0, best.reportCount ?? 0);
    if ((RANK[m.status] ?? 0) > RANK[best.status]) {
      best = { status: m.status, canonical: h.canonical, hash: m.hash, kind: m.kind, reportCount };
    } else {
      best.reportCount = reportCount;
    }
  }
  return best;
}

export function warningPageUrl({ url, status, back }) {
  const params = new URLSearchParams({ url, status });
  if (back) params.set('back', back);
  return `${chrome.runtime.getURL('src/pages/warning.html')}?${params}`;
}
