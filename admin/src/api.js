export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function fetchDashboard() {
  const res = await fetch(`${API_BASE}/api/admin/reports`);
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

// action: 'confirm' (→ block) | 'dismiss'
export async function decide(id, action) {
  const res = await fetch(`${API_BASE}/api/admin/blocklist/${id}/${action}`, { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Server responded ${res.status}`);
  return body;
}

// Live updates via Server-Sent Events. The browser reconnects on its own.
export function subscribe({ onChange, onStatus }) {
  const source = new EventSource(`${API_BASE}/api/admin/stream`);
  source.onopen = () => onStatus('live');
  source.onerror = () => onStatus('reconnecting');
  source.addEventListener('changed', onChange);
  return () => source.close();
}
