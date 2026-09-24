// Inbox and page analysis: gathers directory matches and herd-immunity statuses,
// then hands everything to the pure analyzers in lib/.
import { analyzeEmail } from '../lib/email-analysis.js';
import { analyzePage } from '../lib/page-analysis.js';
import { analyzeLink } from '../lib/link-analysis.js';
import { hostnameOf } from '../lib/normalize.js';
import { hashesForUrl, hashEmail } from '../lib/hash.js';
import { api } from './api.js';
import { checkUrl, lookupHashes, worstStatus } from './navigation.js';
import { getKnownDomains } from './storage.js';

async function lookupDirectory(names) {
  const unique = [...new Set(names.filter((n) => n && n.trim().length >= 3))];
  const entries = await Promise.all(unique.map((name) =>
    api(`/api/directory/lookup?name=${encodeURIComponent(name.trim())}`, { timeoutMs: 3000 })
      .then((r) => r.match)
      .catch(() => null)));
  return new Map(unique.map((name, i) => [name, entries[i]]));
}

// emails: [{ id, senderName, senderEmail, links: [{ text, href }] }] (plain data from the content script)
export async function analyzeInbox(emails) {
  const list = (Array.isArray(emails) ? emails : []).slice(0, 100);
  const knownDomains = await getKnownDomains();

  // Hash every link and sender once; check them all in one batched, prefix-only request.
  const hashed = await Promise.all(list.map(async (e) => ({
    sender: e.senderEmail ? await hashEmail(e.senderEmail) : null,
    links: await Promise.all((e.links ?? []).slice(0, 20).map((l) => hashesForUrl(l.href))),
  })));
  const allHashes = hashed.flatMap((h) => [h.sender, ...h.links.flatMap((l) => (l ? [l.urlHash, l.domainHash] : []))]);
  const [found, directory] = await Promise.all([
    lookupHashes(allHashes).catch(() => new Map()), // fail open
    lookupDirectory(list.map((e) => e.senderName)),
  ]);

  return list.map((email, i) => {
    const h = hashed[i];
    const analysis = analyzeEmail(
      { senderName: email.senderName, senderEmail: email.senderEmail, links: (email.links ?? []).slice(0, 20) },
      {
        knownDomains,
        directoryEntry: directory.get(email.senderName?.trim()) ?? null,
        senderStatus: worstStatus([found.get(h.sender)]),
        linkStatuses: h.links.map((l) => (l ? worstStatus([found.get(l.urlHash), found.get(l.domainHash)]) : 'clean')),
      },
    );
    return { id: email.id, ...analysis };
  });
}

export async function checkPage(url) {
  return analyzePage(url, await getKnownDomains());
}

// Hover tooltip: local checks plus the hash-prefix report check (nothing readable leaves the browser).
export async function linkInfo(text, href) {
  const [knownDomains, reported] = await Promise.all([getKnownDomains(), checkUrl(href)]);
  return analyzeLink({ text, href }, { knownDomains, status: reported.status });
}

// Registration date for a link's domain. Privacy rule, enforced here rather than trusted
// from the page: the plaintext domain goes to the server only if the link is already flagged.
export async function domainAge(text, href) {
  const info = await linkInfo(text, href);
  if (!info || info.verdict === 'safe') return { status: 'skipped' };
  return api(`/api/domain-info?domain=${encodeURIComponent(hostnameOf(href))}`, { timeoutMs: 8000 })
    .catch(() => ({ status: 'unavailable' }));
}
