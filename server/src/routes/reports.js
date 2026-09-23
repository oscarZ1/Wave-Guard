import { Router } from 'express';
import { pool } from '../db/pool.js';
import { validateReport } from '../services/validate.js';
import {
  corroborateSender, corroborateUrl, isMuted, overReportLimit, triageConfig, triageEntry,
} from '../services/triage.js';
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

// Each reporter's track record: past reports whose entry ended up blocked, or dismissed by IT.
const HISTORY_SQL = `
  SELECT r.reporter_id,
         count(DISTINCT r.id) FILTER (WHERE b.status = 'block')::int     AS confirmed,
         count(DISTINCT r.id) FILTER (WHERE b.status = 'dismissed')::int AS dismissed
    FROM reports r
    JOIN blocklist b ON b.hash = r.url_hash OR b.hash = r.domain_hash
                     OR (b.kind = 'sender' AND b.label = r.sender_email)
   WHERE r.reporter_id = ANY($1::text[])
   GROUP BY r.reporter_id`;

async function mutedReporters(client, reporterIds, config) {
  if (!reporterIds.length) return new Set();
  const { rows } = await client.query(HISTORY_SQL, [reporterIds]);
  return new Set(rows.filter((row) => isMuted(row, config)).map((row) => row.reporter_id));
}

async function upsertEntry(client, {
  hash, kind, label, domain, knownDomain, reportersSql, reportersParam, corroboration, config,
}) {
  const { rows: reporterRows } = await client.query(reportersSql, [reportersParam]);
  const reporters = reporterRows.map((row) => row.reporter_id);
  const muted = await mutedReporters(client, reporters, config);
  const credibleReporters = reporters.filter((id) => !muted.has(id)).length;

  const { rows: existing } = await client.query('SELECT status FROM blocklist WHERE hash = $1 FOR UPDATE', [hash]);
  const { status, note } = triageEntry({
    current: existing[0]?.status, credibleReporters, isKnownDomain: knownDomain, corroboration, config,
  });
  const { rows: [row] } = await client.query(
    `INSERT INTO blocklist (hash, kind, status, label, domain, report_count, triage_note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (hash) DO UPDATE
       SET status = EXCLUDED.status, report_count = EXCLUDED.report_count,
           triage_note = COALESCE(EXCLUDED.triage_note, blocklist.triage_note), updated_at = now()
     RETURNING id, kind, status, label, report_count, triage_note`,
    [hash, kind, status, label, domain, reporters.length, note],
  );
  return row;
}

// POST /api/reports: the only place plaintext URLs reach the server (an explicit user action).
// Every report reaches the IT dashboard. Triage decides whether it also warns everyone now.
router.post('/', async (req, res) => {
  const { value: r, error } = validateReport(req.body);
  if (error) return res.status(400).json({ error });
  const config = triageConfig();

  const urlInfo = r.url ? await hashesForUrl(r.url) : null;
  const senderHash = r.sender_email ? await hashEmail(r.sender_email) : null;
  const senderDomain = r.sender_email?.split('@')[1] ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [{ recent }] } = await client.query(
      `SELECT count(*)::int AS recent FROM reports
        WHERE reporter_id = $1 AND created_at > now() - interval '1 hour'`,
      [r.reporter_id],
    );
    if (overReportLimit(recent, config)) {
      await client.query('ROLLBACK');
      return res.status(429).json({
        error: `You've sent ${recent} reports in the last hour. Try again later, or contact the IT Help Desk directly.`,
      });
    }

    const { rows: known } = await client.query('SELECT domain FROM known_domains');
    const knownList = known.map((k) => k.domain);
    const { rows: directory } = r.sender_email
      ? await client.query('SELECT name, title, official_emails, verify_channel FROM directory')
      : { rows: [] };

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
      const corroboration = corroborateUrl(r.url, knownList);
      entries.push(await upsertEntry(client, {
        hash: urlInfo.urlHash, kind: 'url', label: urlInfo.canonical, domain: urlInfo.domain, knownDomain,
        reportersSql: 'SELECT DISTINCT reporter_id FROM reports WHERE url_hash = $1',
        reportersParam: urlInfo.urlHash, corroboration, config,
      }));
      if (domainEntryAllowed(urlInfo.domain, knownDomain)) {
        entries.push(await upsertEntry(client, {
          hash: urlInfo.domainHash, kind: 'domain', label: urlInfo.domain, domain: urlInfo.domain, knownDomain,
          reportersSql: 'SELECT DISTINCT reporter_id FROM reports WHERE domain_hash = $1',
          reportersParam: urlInfo.domainHash, corroboration, config,
        }));
      }
    }
    if (senderHash) {
      entries.push(await upsertEntry(client, {
        hash: senderHash, kind: 'sender', label: r.sender_email, domain: senderDomain,
        knownDomain: isKnownDomain(senderDomain, knownList),
        reportersSql: 'SELECT DISTINCT reporter_id FROM reports WHERE lower(sender_email) = $1',
        reportersParam: r.sender_email,
        corroboration: corroborateSender(
          { email: r.sender_email, displayName: r.sender_display_name },
          { directory, knownDomains: knownList },
        ),
        config,
      }));
    }

    await client.query('COMMIT');
    broadcast({ reason: 'report', reportId: report.id });
    // shared: whether this report now warns other WaveGuard users (false = waiting for IT).
    const shared = entries.some((e) => e.status === 'warn' || e.status === 'block');
    res.status(201).json({ report, entries, shared });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export default router;
