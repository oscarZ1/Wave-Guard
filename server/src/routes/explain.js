import { Router } from 'express';
import { validateExplain } from '../services/explain-input.js';
import { explain } from '../services/llm.js';

const router = Router();

// POST /api/explain: signals + minimal context → { verdict, summary, red_flags, what_to_do, source }
router.post('/', async (req, res) => {
  const { value, error } = validateExplain(req.body);
  if (error) return res.status(400).json({ error });
  res.json(await explain(value));
});

export default router;
