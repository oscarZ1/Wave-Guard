import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

// Allowlist for local heuristics. The extension caches this.
router.get('/', async (req, res) => {
  const { rows } = await query('SELECT domain, owner, purpose FROM known_domains ORDER BY domain');
  res.json({ domains: rows });
});

export default router;
