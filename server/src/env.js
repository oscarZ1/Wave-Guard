// Loads server/.env into process.env. Import this first.
// Unlike `node --env-file`, it also fills variables that exist but are empty:
// some shells export ANTHROPIC_API_KEY="" and that would otherwise hide the key in .env.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

try {
  const values = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8'));
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) process.env[key] = value;
  }
} catch (err) {
  if (err.code !== 'ENOENT') throw err; // no .env file is fine (use real env vars)
}
