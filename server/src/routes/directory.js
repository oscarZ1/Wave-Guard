import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/directory/lookup?name=Dean%20Alex%20Rivera
// Matches when a directory name appears as whole words inside the display name,
// so titles like "Dean" or "Pepperdine" around it don't prevent a match.
router.get('/lookup', async (req, res) => {
  const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
  if (name.length < 3 || name.length > 200) {
    return res.status(400).json({ error: 'name must be 3-200 characters' });
  }
  const { rows } = await query(
    `SELECT id, name, title, department, official_emails, verify_channel
       FROM directory
      WHERE position(lower(name) IN lower($1)) > 0
      ORDER BY length(name) DESC`,
    [name],
  );
  const match = rows.find((row) =>
    new RegExp(`(^|[^a-z0-9])${escapeRegex(row.name.toLowerCase())}([^a-z0-9]|$)`).test(name.toLowerCase()),
  );
  res.json({ match: match ?? null });
});

export default router;
