import { useEffect, useState } from 'react';
import { API_BASE } from './api.js';

// Placeholder for Milestone 1. The live dashboard arrives in Milestone 5.
export default function App() {
  const [health, setHealth] = useState('checking…');

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.json())
      .then((h) => setHealth(h.ok ? 'API and database OK' : `API error: ${h.error}`))
      .catch(() => setHealth(`Cannot reach API at ${API_BASE}`));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>WaveGuard · IT Dashboard</h1>
      <p>{health}</p>
    </main>
  );
}
