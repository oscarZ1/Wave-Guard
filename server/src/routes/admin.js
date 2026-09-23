import { Router } from 'express';
import { pool, query } from '../db/pool.js';
import { AUTO_BLOCK_REPORTERS, statusForDecision } from '../services/status.js';
import { triageConfig } from '../services/triage.js';
import { broadcast, sseHandler } from '../services/sse.js';

const router = Router();

// GET /api/admin/reports: everything the dashboard shows.
router.get('/reports', async (req, res) => {
  const [reports, blocklist, campaigns, stats] = await Promise.all([
    query(`SELECT id, reporter_id, url, domain, sender_email, sender_display_name, excerpt, reason,
                  campaign_id, created_at
             FROM reports ORDER BY created_at DESC LIMIT 200`),
    query(`SELECT id, kind, status, label, domain, report_count, triage_note, created_at, updated_at
             FROM blocklist ORDER BY updated_at DESC`),
    query('SELECT id, label, first_seen, last_seen, report_count FROM campaigns ORDER BY last_seen DESC'),
    query(`SELECT (SELECT count(*) FROM events WHERE type = 'warned')::int    AS users_protected,
                  (SELECT count(*) FROM events WHERE type = 'continued')::int AS continued_anyway,
                  (SELECT count(*) FROM reports)::int                         AS reports,
                  (SELECT count(*) FROM blocklist WHERE status = 'block')::int AS blocked,
                  (SELECT count(*) FROM blocklist WHERE status = 'warn')::int  AS warning,
                  (SELECT count(*) FROM blocklist WHERE status = 'pending')::int AS held`),
  ]);
  const { shareAfterReporters } = triageConfig();
  res.json({
    reports: reports.rows, blocklist: blocklist.rows, campaigns: campaigns.rows, stats: stats.rows[0],
    triage: { shareAfterReporters, autoBlockReporters: AUTO_BLOCK_REPORTERS },
  });
});

// POST /api/admin/blocklist/:id/confirm | /dismiss | /share
// A decision on a domain also applies to every reported URL on that domain.
// "share" releases an entry triage is holding back; it never downgrades a block.
const DECISION_NOTE = {
  confirm: 'Confirmed as phishing by IT.',
  dismiss: 'Dismissed by IT.',
  share: 'Warning everyone: IT chose to share it.',
};

router.post('/blocklist/:id/:action', async (req, res) => {
  const id = Number(req.params.id);
  const { action } = req.params;
  const status = statusForDecision(action);
  if (!Number.isInteger(id) || id <= 0 || !status) {
    return res.status(400).json({ error: 'use /blocklist/<id>/confirm, /blocklist/<id>/dismiss or /blocklist/<id>/share' });
  }
  const onlyPending = action === 'share' ? " AND status = 'pending'" : '';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [row] } = await client.query(
      `UPDATE blocklist SET status = $1, triage_note = $3, updated_at = now() WHERE id = $2${onlyPending}
       RETURNING id, kind, status, label, domain, report_count, triage_note`,
      [status, id, DECISION_NOTE[action]],
    );
    if (!row) {
      const { rowCount: exists } = await client.query('SELECT 1 FROM blocklist WHERE id = $1', [id]);
      await client.query('ROLLBACK');
      return exists
        ? res.status(409).json({ error: 'Only entries held for review can be shared' })
        : res.status(404).json({ error: 'blocklist entry not found' });
    }
    let cascaded = 0;
    if (row.kind === 'domain') {
      ({ rowCount: cascaded } = await client.query(
        `UPDATE blocklist SET status = $1, triage_note = $3, updated_at = now()
          WHERE kind = 'url' AND domain = $2${onlyPending}`,
        [status, row.domain, DECISION_NOTE[action]],
      ));
    }
    await client.query('COMMIT');
    broadcast({ reason: action, id });
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
