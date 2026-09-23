// Thin fetch wrapper for the campus API. Callers decide whether to fail open.
import { API_BASE } from './config.js';

export async function api(path, { method = 'GET', body, timeoutMs = 1500 } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);
  return data;
}

// Hash-only usage log for the "users protected" counter. Never throws.
export function postEvent(type, hash) {
  return api('/api/events', { method: 'POST', body: { type, hash: hash ?? null } }).catch(() => {});
}
