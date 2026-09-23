// Inbox and page analysis: gathers directory matches and herd-immunity statuses,
// then hands everything to the pure analyzers in lib/.
import { analyzeEmail } from '../lib/email-analysis.js';
import { analyzePage } from '../lib/page-analysis.js';
import { hashesForUrl, hashEmail } from '../lib/hash.js';
import { api } from './api.js';
import { lookupHashes, worstStatus } from './navigation.js';
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
