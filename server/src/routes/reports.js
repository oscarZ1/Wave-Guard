import { Router } from 'express';
import { pool } from '../db/pool.js';
import { validateReport } from '../services/validate.js';
import { computeStatus } from '../services/status.js';
import { broadcast } from '../services/sse.js';
import {
  hashesForUrl, hashEmail, hostnameOf, isKnownDomain, isIpAddress,
} from '../../../extension/src/lib/index.js';

const router = Router();

// No domain-wide entry for allowlisted sites, localhost or IPs: one report of a
// Google Forms phish must not warn every google.com page for everyone.
function domainEntryAllowed(domain, knownDomain) {
  return Boolean(domain) && !knownDomain && !isIpAddress(domain) && domain.includes('.');
}

async function upsertEntry(client, { hash, kind, label, domain, knownDomain, countSql, countParam }) {
  const { rows: [{ n }] } = await client.query(countSql, [countParam]);
  const { rows: existing } = await client.query('SELECT status FROM blocklist WHERE hash = $1 FOR UPDATE', [hash]);
  const status = computeStatus({ current: existing[0]?.status, distinctReporters: n, isKnownDomain: knownDomain });
  const { rows: [row] } = await client.query(
    `INSERT INTO blocklist (hash, kind, status, label, domain, report_count)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (hash) DO UPDATE
       SET status = EXCLUDED.status, report_count = EXCLUDED.report_count, updated_at = now()
     RETURNING id, kind, status, label, report_count`,
    [hash, kind, status, label, domain, n],
  );
  return row;
}

// POST /api/reports: the only place plaintext URLs reach the server (an explicit user action).
router.post('/', async (req, res) => {
  const { value: r, error } = validateReport(req.body);
  if (error) return res.status(400).json({ error });

  const urlInfo = r.url ? await hashesForUrl(r.url) : null;
  const senderHash = r.sender_email ? await hashEmail(r.sender_email) : null;
  const senderDomain = r.sender_email?.split('@')[1] ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: known } = await client.query('SELECT domain FROM known_domains');
    const knownList = known.map((k) => k.domain);

    const { rows: [report] } = await client.query(
      `INSERT INTO reports (reporter_id, url, domain, url_hash, domain_hash, sender_email,
                            sender_display_name, excerpt, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at`,
      [r.reporter_id, r.url, urlInfo?.domain ?? null, urlInfo?.urlHash ?? null, urlInfo?.domainHash ?? null,
        r.sender_email, r.sender_display_name, r.excerpt, r.reason],
    );

    const entries = [];
    if (urlInfo) {
      const knownDomain = isKnownDomain(hostnameOf(r.url), knownList);
      entries.push(await upsertEntry(client, {
        hash: urlInfo.urlHash, kind: 'url', label: urlInfo.canonical, domain: urlInfo.domain, knownDomain,
        countSql: 'SELECT count(DISTINCT reporter_id)::int AS n FROM reports WHERE url_hash = $1',
        countParam: urlInfo.urlHash,
      }));
      if (domainEntryAllowed(urlInfo.domain, knownDomain)) {
        entries.push(await upsertEntry(client, {
          hash: urlInfo.domainHash, kind: 'domain', label: urlInfo.domain, domain: urlInfo.domain, knownDomain,
          countSql: 'SELECT count(DISTINCT reporter_id)::int AS n FROM reports WHERE domain_hash = $1',
          countParam: urlInfo.domainHash,
        }));
      }
    }
    if (senderHash) {
      entries.push(await upsertEntry(client, {
        hash: senderHash, kind: 'sender', label: r.sender_email, domain: senderDomain,
        knownDomain: isKnownDomain(senderDomain, knownList),
        countSql: 'SELECT count(DISTINCT reporter_id)::int AS n FROM reports WHERE lower(sender_email) = $1',
        countParam: r.sender_email,
      }));
    }

    await client.query('COMMIT');
    broadcast({ reason: 'report', reportId: report.id });
    res.status(201).json({ report, entries });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export default router;
