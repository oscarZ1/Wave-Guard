// Request-body validation. Each validator returns { value } or { error }.
import { canonicalizeUrl, PREFIX_PATTERN } from '../../../extension/src/lib/index.js';

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const HASH = /^[0-9a-f]{64}$/;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function optionalString(body, key, max) {
  const v = body[key];
  if (v === undefined || v === null || v === '') return { value: null };
  if (typeof v !== 'string') return { error: `${key} must be a string` };
  const t = v.trim();
  if (t.length > max) return { error: `${key} must be at most ${max} characters` };
  return { value: t || null };
}

export function validateReport(body) {
  if (!isObject(body)) return { error: 'body must be a JSON object' };

  const reporter = optionalString(body, 'reporter_id', 200);
  if (reporter.error) return reporter;
  if (!reporter.value || !EMAIL.test(reporter.value)) return { error: 'reporter_id must be an email address' };

  const url = optionalString(body, 'url', 2048);
  if (url.error) return url;
  if (url.value && !canonicalizeUrl(url.value)) return { error: 'url must be an http(s) URL' };

  const sender = optionalString(body, 'sender_email', 254);
  if (sender.error) return sender;
  if (sender.value && !EMAIL.test(sender.value)) return { error: 'sender_email must be an email address' };

  if (!url.value && !sender.value) return { error: 'a report needs a url or a sender_email' };

  const name = optionalString(body, 'sender_display_name', 200);
  if (name.error) return name;
  const reason = optionalString(body, 'reason', 500);
  if (reason.error) return reason;
  // Excerpts are capped at 500 characters; longer ones are trimmed rather than rejected.
  const excerpt = optionalString(body, 'excerpt', 20_000);
  if (excerpt.error) return excerpt;

  return {
    value: {
      reporter_id: reporter.value.toLowerCase(),
      url: url.value,
      sender_email: sender.value?.toLowerCase() ?? null,
      sender_display_name: name.value,
      excerpt: excerpt.value?.slice(0, 500) ?? null,
      reason: reason.value,
    },
  };
}

export function validateCheck(body) {
  if (!isObject(body) || !Array.isArray(body.prefixes)) return { error: 'prefixes must be an array' };
  const { prefixes } = body;
  if (prefixes.length < 1 || prefixes.length > 50) return { error: 'send between 1 and 50 prefixes' };
  if (!prefixes.every((p) => typeof p === 'string' && PREFIX_PATTERN.test(p))) {
    return { error: 'each prefix must be 8 lowercase hex characters' };
  }
  return { value: [...new Set(prefixes)] };
}

export function validateEvent(body) {
  if (!isObject(body)) return { error: 'body must be a JSON object' };
  if (body.type !== 'warned' && body.type !== 'continued') return { error: 'type must be warned or continued' };
  if (body.hash !== undefined && body.hash !== null && !(typeof body.hash === 'string' && HASH.test(body.hash))) {
    return { error: 'hash must be 64 lowercase hex characters' };
  }
  return { value: { type: body.type, hash: body.hash ?? null } };
}
