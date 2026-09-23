// Sender impersonation: the display name matches someone in the campus directory,
// but the email address isn't one of their official addresses.
import { clean, flag } from './result.js';
import { ORG_DOMAINS } from './known-domains.js';

export const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
  'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com',
  'mail.com', 'yandex.com', 'zoho.com',
]);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// True when the directory name appears as whole words in the display name,
// so "Dean Alex Rivera" matches "Alex Rivera" but "Alexandra Rivers" does not.
export function nameMatches(displayName, directoryName) {
  if (!displayName || !directoryName) return false;
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(directoryName.toLowerCase())}($|[^\\p{L}\\p{N}])`, 'u');
  return pattern.test(displayName.toLowerCase());
}

// sender: { displayName, email }; entry: a directory row (or null when no match).
export function checkSenderImpersonation(sender, entry, orgDomains = ORG_DOMAINS) {
  const displayName = sender?.displayName?.trim();
  const email = sender?.email?.trim().toLowerCase();
  if (!displayName || !email || !entry || !nameMatches(displayName, entry.name)) return clean();

  const official = (entry.official_emails ?? []).map((e) => e.toLowerCase());
  if (official.includes(email)) return clean();

  const domain = email.split('@')[1] ?? '';
  const who = entry.title ? `${entry.name} (${entry.title})` : entry.name;
  const realAddress = official[0] ? ` Their official address is ${official[0]}.` : '';
  const verify = entry.verify_channel ? ` If unsure, check with them via: ${entry.verify_channel}.` : '';

  if (FREE_MAIL_DOMAINS.has(domain)) {
    return flag('high', `This email claims to be from ${who}, but it was sent from a personal ${domain} account.${realAddress}${verify}`);
  }
  if (orgDomains.includes(domain)) {
    return flag('medium', `This email uses the name of ${who}, but ${email} is not one of their official addresses.${realAddress}${verify}`);
  }
  return flag('high', `This email claims to be from ${who}, but it came from ${domain}, which is not a Pepperdine address.${realAddress}${verify}`);
}
