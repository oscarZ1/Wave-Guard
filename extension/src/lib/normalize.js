// URL and hostname normalization shared by the extension and the server.
// Pure functions only: no Chrome APIs, so Node can test them.

// Two-label public suffixes: the domain someone registers sits one label below these.
const COUNTRY_SUFFIXES = new Set([
  'co.uk', 'ac.uk', 'org.uk', 'gov.uk', 'com.au', 'edu.au', 'co.nz', 'co.jp',
  'co.in', 'com.br', 'com.mx', 'com.cn',
]);

// Free hosting platforms: each subdomain belongs to a different person, so reporting
// one must not block all, and the platform's own registration date says nothing about it.
const HOSTING_PLATFORMS = new Set([
  'github.io', 'gitlab.io', 'web.app', 'firebaseapp.com', 'pages.dev', 'workers.dev',
  'vercel.app', 'netlify.app', 'herokuapp.com', 'glitch.me', 'repl.co',
  'blogspot.com', 'wixsite.com', 'weebly.com', 'azurewebsites.net', 'ngrok.io', 'ngrok-free.app',
]);

// Reserved names that never exist on the public internet.
const LOCAL_TLDS = new Set(['localhost', 'test', 'local', 'example', 'invalid', 'internal', 'lan', 'home']);

export function parseHttpUrl(input) {
  if (typeof input !== 'string' || input.length > 4096) return null;
  try {
    const url = new URL(input.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function hostnameOf(input) {
  const url = parseHttpUrl(input);
  return url ? cleanHost(url.hostname) : null;
}

export function cleanHost(host) {
  return String(host).toLowerCase().replace(/\.+$/, '');
}

export function isIpAddress(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[');
}

// Scheme-less canonical form, Safe Browsing style: host[:port]/path?query.
// Dropping the scheme means an http→https upgrade keeps the same hash.
export function canonicalizeUrl(input) {
  const url = parseHttpUrl(input);
  if (!url) return null;
  const host = cleanHost(url.hostname);
  const port = url.port ? `:${url.port}` : '';
  return `${host}${port}${url.pathname || '/'}${url.search}`;
}

// The part of a hostname that one owner controls: "login.evil.co.uk" → "evil.co.uk".
export function registrableDomain(host) {
  if (!host) return null;
  const h = cleanHost(host);
  if (isIpAddress(h)) return h;
  const labels = h.split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  return COUNTRY_SUFFIXES.has(lastTwo) || HOSTING_PLATFORMS.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

// "pepperdlne.edu" → "pepperdlne"; "evil.co.uk" → "evil".
export function secondLevelLabel(registrable) {
  if (!registrable || isIpAddress(registrable)) return registrable;
  return registrable.split('.')[0];
}

// Everything before the registrable domain: "a.b.evil.com" → "a.b".
export function subdomainPart(host) {
  const h = cleanHost(host);
  const reg = registrableDomain(h);
  return h === reg ? '' : h.slice(0, -(reg.length + 1));
}

// "evil.github.io" → "github.io"; null when the host isn't on a free hosting platform.
export function hostingPlatformOf(host) {
  const labels = cleanHost(host).split('.');
  const lastTwo = labels.slice(-2).join('.');
  return labels.length >= 3 && HOSTING_PLATFORMS.has(lastTwo) ? lastTwo : null;
}

// False for localhost, reserved test TLDs, IP addresses and single-label names.
export function isPublicHost(host) {
  if (!host) return false;
  const h = cleanHost(host);
  if (isIpAddress(h) || !h.includes('.')) return false;
  return !LOCAL_TLDS.has(h.split('.').pop());
}
