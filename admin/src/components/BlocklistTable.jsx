import StatusBadge from './StatusBadge.jsx';
import { absoluteTime, relativeTime } from '../time.js';

const KIND = { domain: 'Website', url: 'Link', sender: 'Email sender' };

// items: top-level entries (sites, senders, and links on sites without a site entry),
// each with `links`: reported URLs on that site.
export default function BlocklistTable({ items, onDecide, busyId, now, freshIds }) {
  if (!items.length) {
    return <p className="empty">Nothing reported yet. When someone clicks Report in WaveGuard, it appears here instantly.</p>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Reported</th>
          <th>Type</th>
          <th>Status</th>
          <th className="num">Reporters</th>
          <th>Last activity</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className={freshIds.has(item.id) ? 'fresh' : undefined}>
            <td>
              <div className="label">{item.label}</div>
              {item.links.length > 0 && (
                <ul className="sublinks">
                  {item.links.map((l) => <li key={l.id}>{l.label}</li>)}
                </ul>
              )}
            </td>
            <td>{KIND[item.kind] ?? item.kind}</td>
            <td><StatusBadge status={item.status} /></td>
            <td className="num">{item.report_count}</td>
            <td title={absoluteTime(item.updated_at)}>{relativeTime(item.updated_at, now)}</td>
            <td className="actions">
              <div className="action-group">
              {item.status !== 'block' && (
                <button className="btn btn-danger" disabled={busyId === item.id} onClick={() => onDecide(item, 'confirm')}>
                  Confirm phishing
                </button>
              )}
              {item.status !== 'dismissed' && (
                <button className="btn" disabled={busyId === item.id} onClick={() => onDecide(item, 'dismiss')}>
                  Dismiss
                </button>
              )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
