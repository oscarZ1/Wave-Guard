// Validates a "Why?" request and reduces it to the minimum the model needs.
// Privacy: email addresses other than the sender's are removed, and links are sent as hostnames only.
const EMAIL_IN_TEXT = /[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/gi;
const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"']+/gi;
const HOST = /^[a-z0-9.-]{1,253}(:\d{1,5})?$/i;
const SEVERITIES = new Set(['low', 'medium', 'high']);

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function sanitizeExcerpt(text, senderEmail) {
  if (!text) return null;
  const sender = senderEmail?.toLowerCase();
  return text
    .replace(EMAIL_IN_TEXT, (m) => (m.toLowerCase() === sender ? m : '[email address removed]'))
    .replace(URL_IN_TEXT, (m) => {
      try { return `[link to ${new URL(m).host}]`; } catch { return '[link]'; }
    })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

// → { value } or { error }
export function validateExplain(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'body must be a JSON object' };
  if (body.kind !== 'email' && body.kind !== 'website') return { error: 'kind must be "email" or "website"' };
  if (!Array.isArray(body.signals) || body.signals.length < 1 || body.signals.length > 10) {
    return { error: 'signals must be an array of 1-10 items' };
  }
  const signals = [];
  for (const s of body.signals) {
    const reason = str(s?.reason, 400);
    if (!reason) return { error: 'each signal needs a reason' };
    signals.push({ reason, severity: SEVERITIES.has(s.severity) ? s.severity : 'medium' });
  }

  const senderEmail = str(body.sender_email, 254)?.toLowerCase() ?? null;
  if (senderEmail && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(senderEmail)) return { error: 'sender_email must be an email address' };
  const site = str(body.site, 260)?.toLowerCase() ?? null;
  if (site && !HOST.test(site)) return { error: 'site must be a hostname' };
  const linkHosts = Array.isArray(body.link_hosts)
    ? [...new Set(body.link_hosts.map((h) => str(h, 260)?.toLowerCase()).filter((h) => h && HOST.test(h)))].slice(0, 10)
    : [];
  const status = body.status === 'warn' || body.status === 'block' ? body.status : null;
  const reportCount = Number.isInteger(body.report_count) && body.report_count >= 0 ? Math.min(body.report_count, 10_000) : null;

  return {
    value: {
      kind: body.kind,
      signals,
      sender_name: str(body.sender_name, 200),
      sender_email: senderEmail,
      subject: str(body.subject, 300),
      excerpt: sanitizeExcerpt(str(body.excerpt, 5000), senderEmail),
      link_hosts: linkHosts,
      site,
      status,
      report_count: reportCount,
    },
  };
}

// Used when the model is unavailable, refuses, or returns something invalid.
export function heuristicExplanation(input) {
  const high = input.signals.some((s) => s.severity === 'high');
  const noun = input.kind === 'email' ? 'email' : 'website';
  return {
    verdict: high ? 'phishing' : 'suspicious',
    summary: high
      ? `WaveGuard found strong signs that this ${noun} is a phishing attempt.`
      : `WaveGuard found some warning signs on this ${noun}.`,
    red_flags: input.signals.slice(0, 4).map((s) => ({ text: s.reason, why: '' })),
    what_to_do: input.kind === 'email'
      ? "Don't click links, reply, or send money or passwords. If it claims to be from someone at Pepperdine, contact them through a channel you already trust, and report the email."
      : "Don't enter your Pepperdine password or personal information here. Close the page, and go to Pepperdine sites by typing pepperdine.edu yourself.",
  };
}
