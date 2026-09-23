// Creates the database if needed, then loads schema.sql and seed.sql.
// Usage: node src/db/setup.js          (skips if tables already exist)
//        node src/db/setup.js --reset  (drops everything and reseeds)
import '../env.js';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const reset = process.argv.includes('--reset');
const url = new URL(process.env.DATABASE_URL ?? '');
const dbName = decodeURIComponent(url.pathname.slice(1));
if (!dbName) throw new Error('DATABASE_URL must include a database name.');

async function ensureDatabase() {
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount === 0) {
      // Identifiers can't be parameterized; quote it safely instead.
      await admin.query(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
      console.log(`Created database ${dbName}`);
    }
  } finally {
    await admin.end();
  }
}

async function load() {
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const { rows } = await client.query("SELECT to_regclass('public.blocklist') AS t");
    if (rows[0].t && !reset) {
      console.log('Tables already exist. Run `npm run db:reset` to wipe and reseed.');
      return;
    }
    const dir = new URL('.', import.meta.url);
    await client.query(await readFile(new URL('schema.sql', dir), 'utf8'));
    await client.query(await readFile(new URL('seed.sql', dir), 'utf8'));
    console.log(`Schema and seed loaded into ${dbName}`);
  } finally {
    await client.end();
  }
}

await ensureDatabase();
await load();
