import { Router } from 'express';
import { query } from '../db/pool.js';
import { validateEvent } from '../services/validate.js';
import { broadcast } from '../services/sse.js';

const router = Router();

// POST /api/events { type: "warned" | "continued", hash? }
// Hash-only log behind the "users protected" counter.
router.post('/', async (req, res) => {
  const { value, error } = validateEvent(req.body);
  if (error) return res.status(400).json({ error });
  await query('INSERT INTO events (type, hash) VALUES ($1, $2)', [value.type, value.hash]);
  broadcast({ reason: value.type });
  res.status(201).json({ ok: true });
});

export default router;
