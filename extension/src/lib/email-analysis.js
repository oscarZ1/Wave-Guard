// Combines every signal about one email into a verdict for the inline banner.
// Pure: the service worker does the I/O (directory lookup, hash checks) and passes results in.
import { SEVERITY_RANK } from './result.js';
import { checkSenderImpersonation } from './sender.js';
import { checkLinkMismatch } from './link-mismatch.js';
import { checkBrandInWrongPlace } from './brand.js';
import { checkLookalike } from './lookalike.js';
import { hostnameOf } from './normalize.js';
import { decodeHost } from './homoglyphs.js';
import { DEFAULT_KNOWN_DOMAINS } from './known-domains.js';

const REPORTED_REASON = {
  link: {
    warn: 'Another Pepperdine user reported this link as phishing.',
    block: 'Pepperdine IT confirmed this link is phishing.',
  },
  sender: {
    warn: 'Other Pepperdine users reported this sender as phishing.',
    block: 'Pepperdine IT confirmed this sender sends phishing.',
  },
};

// email: { senderName, senderEmail, links: [{ text, href }] }
// context: { directoryEntry, knownDomains, senderStatus, linkStatuses: [status|null per link] }
// → { verdict: 'danger' | 'caution' | 'safe', title, findings: [{ kind, severity, reason, link? }],
//     verifiedSender: { name, title } | null, flaggedLinks: [{ index, realHost, reasons }] }
export function analyzeEmail(email, context = {}) {
  const knownDomains = context.knownDomains ?? DEFAULT_KNOWN_DOMAINS;
  const entry = context.directoryEntry ?? null;
  const senderEmail = String(email.senderEmail ?? '').trim().toLowerCase();
  const senderDomain = senderEmail.split('@')[1] ?? '';
  const findings = [];
  const add = (kind, result, extra = {}) => {
    if (result?.triggered) findings.push({ kind, severity: result.severity, reason: result.reason, ...extra });
  };

  // Sender
  add('impersonation', checkSenderImpersonation({ displayName: email.senderName, email: senderEmail }, entry));
  if (senderDomain) {
    const look = checkLookalike(senderDomain, knownDomains);
    add('sender-lookalike', look.triggered ? { ...look, reason: `The sender's address is fake: ${look.reason}` } : look);
    if (!look.triggered) {
      const brand = checkBrandInWrongPlace(`http://${senderDomain}/`, knownDomains);
      add('sender-brand', brand.triggered ? { ...brand, reason: `The sender's address ${lowerFirst(brand.reason)}` } : brand);
    }
  }
  const senderStatus = context.senderStatus;
  if (senderStatus === 'warn' || senderStatus === 'block') {
    add('reported-sender', { triggered: true, severity: 'high', reason: REPORTED_REASON.sender[senderStatus] });
  }

  // Links
  const flaggedLinks = [];
  (email.links ?? []).forEach((link, index) => {
    const before = findings.length;
    add('link-mismatch', checkLinkMismatch(link.text, link.href), { link: index });
    const host = hostnameOf(link.href);
    if (host) {
      const brand = checkBrandInWrongPlace(link.href, knownDomains);
      add('link-brand', brand, { link: index });
      if (!brand.triggered) add('link-lookalike', checkLookalike(host, knownDomains), { link: index });
    }
    const status = context.linkStatuses?.[index];
    if (status === 'warn' || status === 'block') {
      add('reported-link', { triggered: true, severity: 'high', reason: REPORTED_REASON.link[status] }, { link: index });
    }
    if (findings.length > before && host) {
      flaggedLinks.push({ index, realHost: decodeHost(host), reasons: findings.slice(before).map((f) => f.reason) });
    }
  });

  // One finding per distinct reason, most severe first.
  const unique = [...new Map(findings.map((f) => [f.reason, f])).values()]
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  const verdict = unique.some((f) => f.severity === 'high') ? 'danger'
    : unique.some((f) => f.severity === 'medium') ? 'caution' : 'safe';

  const officialSender = entry && (entry.official_emails ?? []).map((e) => e.toLowerCase()).includes(senderEmail);
  return {
    verdict,
    title: titleFor(verdict, unique, entry),
    findings: unique,
    verifiedSender: verdict === 'safe' && officialSender ? { name: entry.name, title: entry.title ?? null } : null,
    flaggedLinks,
  };
}

function titleFor(verdict, findings, entry) {
  if (verdict === 'safe') return '';
  const kinds = new Set(findings.map((f) => f.kind));
  if (kinds.has('impersonation') && entry) return `This email is pretending to be ${entry.name}`;
  if (kinds.has('reported-link') || kinds.has('reported-sender')) return 'Pepperdine users reported this email as phishing';
  if (kinds.has('link-mismatch')) return 'This email hides where its link really goes';
  if (verdict === 'danger') return 'This email looks like phishing';
  return 'Be careful with this email';
}

function lowerFirst(text) {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}
