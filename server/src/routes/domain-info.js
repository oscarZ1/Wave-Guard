import { Router } from 'express';
import { getDomainInfo } from '../services/rdap.js';

const router = Router();
const HOSTNAME = /^[a-z0-9.-]{1,253}$/;

// GET /api/domain-info?domain=example.com → registration date and age (RDAP, cached).
// The extension only asks for links a local check has already flagged.
router.get('/', async (req, res) => {
  const domain = typeof req.query.domain === 'string' ? req.query.domain.trim().toLowerCase() : '';
  if (!HOSTNAME.test(domain)) return res.status(400).json({ error: 'domain must be an ASCII hostname' });
  res.json(await getDomainInfo(domain));
});

export default router;
