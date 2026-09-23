import { API_BASE } from '../background/config.js';

const serverEl = document.getElementById('server');

try {
  const res = await fetch(`${API_BASE}/api/health`);
  const health = await res.json();
  serverEl.textContent = health.ok ? 'Connected to campus server.' : `Server error: ${health.error}`;
} catch {
  serverEl.textContent = `Campus server unreachable at ${API_BASE}.`;
}
