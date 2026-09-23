import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decide, fetchDashboard, subscribe } from './api.js';
import StatTile from './components/StatTile.jsx';
import BlocklistTable from './components/BlocklistTable.jsx';
import ReportFeed from './components/ReportFeed.jsx';

const STATUS_ORDER = { warn: 0, block: 1, dismissed: 2 };
const FRESH_MS = 6000;

// Nest reported links under their website entry, so each row is one thing IT decides on.
function groupEntries(blocklist) {
  const sites = new Set(blocklist.filter((e) => e.kind === 'domain').map((e) => e.domain));
  return blocklist
    .filter((e) => e.kind !== 'url' || !sites.has(e.domain))
    .map((e) => ({ ...e, links: e.kind === 'domain' ? blocklist.filter((u) => u.kind === 'url' && u.domain === e.domain) : [] }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || new Date(b.updated_at) - new Date(a.updated_at));
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState('connecting');
  const [busyId, setBusyId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [fresh, setFresh] = useState({ reports: new Set(), entries: new Set() });
  const seen = useRef(null); // ids from the previous load, to highlight what just arrived

  const load = useCallback(async () => {
    try {
      const next = await fetchDashboard();
      setError('');
      if (seen.current) {
        const reports = new Set(next.reports.filter((r) => !seen.current.reports.has(r.id)).map((r) => r.id));
        const entries = new Set(next.blocklist
          .filter((e) => { const prev = seen.current.entries.get(e.id); return !prev || prev !== e.updated_at; })
          .map((e) => e.id));
        if (reports.size || entries.size) {
          setFresh({ reports, entries });
          setTimeout(() => setFresh({ reports: new Set(), entries: new Set() }), FRESH_MS);
        }
      }
      seen.current = {
        reports: new Set(next.reports.map((r) => r.id)),
        entries: new Map(next.blocklist.map((e) => [e.id, e.updated_at])),
      };
      setData(next);
    } catch (err) {
      setError(`Can't load reports: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    load();
    let timer;
    const unsubscribe = subscribe({
      onStatus: setLive,
      onChange: () => { clearTimeout(timer); timer = setTimeout(load, 150); },
    });
    const clock = setInterval(() => setNow(Date.now()), 15_000);
    return () => { unsubscribe(); clearInterval(clock); clearTimeout(timer); };
  }, [load]);

  const items = useMemo(() => (data ? groupEntries(data.blocklist) : []), [data]);
  // Entry ids that changed, mapped to the row that shows them.
  const freshRows = useMemo(() => new Set(items
    .filter((i) => fresh.entries.has(i.id) || i.links.some((l) => fresh.entries.has(l.id)))
    .map((i) => i.id)), [items, fresh]);

  async function onDecide(item, action) {
    setBusyId(item.id);
    try {
      await decide(item.id, action);
      await load();
    } catch (err) {
      setError(`Couldn't ${action}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  const stats = data?.stats ?? {};
  const awaiting = items.filter((i) => i.status === 'warn').length;
  const blocked = items.filter((i) => i.status === 'block').length;

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">WaveGuard</span>
          <span className="brand-title">Pepperdine IT · Phishing reports</span>
        </div>
        <span className={`live live-${live}`} role="status">
          <span className="live-dot" aria-hidden="true" />
          {live === 'live' ? 'Live' : live === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </span>
      </header>

      {error && <div className="error" role="alert">{error}</div>}

      <div className="kpis">
        <StatTile hero label="Users protected" value={stats.users_protected} caption="Times WaveGuard stopped someone before a reported site loaded" />
        <StatTile label="Awaiting IT review" value={awaiting} caption="Warning users now" />
        <StatTile label="Blocked" value={blocked} caption="Confirmed phishing" />
        <StatTile label="Reports received" value={stats.reports} caption={`${Number(stats.continued_anyway ?? 0).toLocaleString()} clicked "Continue anyway"`} />
      </div>

      <div className="columns">
        <section className="card">
          <h2>Reported sites and senders</h2>
          <p className="card-sub">One report warns everyone. Three people, or your confirmation, blocks it. Confirming a website also blocks every reported link on it.</p>
          {data ? (
            <BlocklistTable items={items} onDecide={onDecide} busyId={busyId} now={now} freshIds={freshRows} />
          ) : <p className="empty">Loading…</p>}
        </section>

        <section className="card">
          <h2>Latest reports</h2>
          {data ? <ReportFeed reports={data.reports.slice(0, 25)} now={now} freshIds={fresh.reports} /> : <p className="empty">Loading…</p>}
        </section>
      </div>
    </div>
  );
}
