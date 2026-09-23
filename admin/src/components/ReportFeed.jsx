import { absoluteTime, relativeTime } from '../time.js';

export default function ReportFeed({ reports, now, freshIds }) {
  if (!reports.length) return <p className="empty">No reports yet.</p>;
  return (
    <ol className="feed">
      {reports.map((r) => (
        <li key={r.id} className={freshIds.has(r.id) ? 'fresh' : undefined}>
          <div className="feed-top">
            <span className="feed-what">{r.url ?? r.sender_email}</span>
            <time title={absoluteTime(r.created_at)}>{relativeTime(r.created_at, now)}</time>
          </div>
          <div className="feed-meta">
            Reported by {r.reporter_id}
            {r.sender_email && r.url && <> · sender {r.sender_display_name ? `"${r.sender_display_name}" ` : ''}{r.sender_email}</>}
            {r.sender_email && !r.url && r.sender_display_name && <> · shown as "{r.sender_display_name}"</>}
          </div>
          {r.reason && <div className="feed-reason">{r.reason}</div>}
          {r.excerpt && <blockquote className="feed-excerpt"><span>{r.excerpt}</span></blockquote>}
        </li>
      ))}
    </ol>
  );
}
