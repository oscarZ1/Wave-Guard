import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env.');
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export function query(text, params) {
  return pool.query(text, params);
}
