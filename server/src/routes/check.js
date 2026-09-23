import { Router } from 'express';
import { query } from '../db/pool.js';
import { validateCheck } from '../services/validate.js';

const router = Router();

// POST /api/check { prefixes: ["1a2b3c4d", ...] }
// Returns every full hash starting with those prefixes. The extension compares
// full hashes locally, so the server never learns which URL was visited.
// Only shared entries: 'pending' reports are visible to IT alone until triage or IT shares them.
router.post('/', async (req, res) => {
  const { value: prefixes, error } = validateCheck(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await query(
    `SELECT hash, kind, status, report_count
       FROM blocklist
      WHERE substr(hash, 1, 8) = ANY($1::text[]) AND status IN ('warn', 'block')`,
    [prefixes],
  );
  res.json({ matches: rows });
});

export default router;
