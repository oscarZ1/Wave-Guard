import { Router } from 'express';
import { pool, query } from '../db/pool.js';
import { statusForDecision } from '../services/status.js';
import { broadcast, sseHandler } from '../services/sse.js';

const router = Router();

// GET /api/admin/reports: everything the dashboard shows.
router.get('/reports', async (req, res) => {
  const [reports, blocklist, campaigns, stats] = await Promise.all([
    query(`SELECT id, reporter_id, url, domain, sender_email, sender_display_name, excerpt, reason,
                  campaign_id, created_at
             FROM reports ORDER BY created_at DESC LIMIT 200`),
    query(`SELECT id, kind, status, label, domain, report_count, created_at, updated_at
             FROM blocklist ORDER BY updated_at DESC`),
    query('SELECT id, label, first_seen, last_seen, report_count FROM campaigns ORDER BY last_seen DESC'),
    query(`SELECT (SELECT count(*) FROM events WHERE type = 'warned')::int    AS users_protected,
                  (SELECT count(*) FROM events WHERE type = 'continued')::int AS continued_anyway,
                  (SELECT count(*) FROM reports)::int                         AS reports,
                  (SELECT count(*) FROM blocklist WHERE status = 'block')::int AS blocked,
                  (SELECT count(*) FROM blocklist WHERE status = 'warn')::int  AS warning`),
  ]);
  res.json({ reports: reports.rows, blocklist: blocklist.rows, campaigns: campaigns.rows, stats: stats.rows[0] });
});

// POST /api/admin/blocklist/:id/confirm | /dismiss
// A decision on a domain also applies to every reported URL on that domain.
router.post('/blocklist/:id/:action', async (req, res) => {
  const id = Number(req.params.id);
  const status = statusForDecision(req.params.action);
  if (!Number.isInteger(id) || id <= 0 || !status) {
    return res.status(400).json({ error: 'use /blocklist/<id>/confirm or /blocklist/<id>/dismiss' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [row] } = await client.query(
      `UPDATE blocklist SET status = $1, updated_at = now() WHERE id = $2
       RETURNING id, kind, status, label, domain, report_count`,
      [status, id],
    );
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'blocklist entry not found' });
    }
    let cascaded = 0;
    if (row.kind === 'domain') {
      ({ rowCount: cascaded } = await client.query(
        `UPDATE blocklist SET status = $1, updated_at = now() WHERE kind = 'url' AND domain = $2`,
        [status, row.domain],
      ));
    }
    await client.query('COMMIT');
    broadcast({ reason: req.params.action, id });
    res.json({ entry: row, cascaded });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.get('/stream', sseHandler);

export default router;
