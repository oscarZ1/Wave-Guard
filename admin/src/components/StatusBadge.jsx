// Status always ships as icon + label + colored dot, so color never carries meaning alone.
const STATUS = {
  pending: { icon: '⏸', label: 'Held for review', hint: 'Only IT can see this. Nobody is warned yet.' },
  warn: { icon: '⚠', label: 'Warning users', hint: 'Reported by users, waiting for IT review' },
  block: { icon: '⛔', label: 'Blocked', hint: 'Full block page for everyone' },
  dismissed: { icon: '✓', label: 'Dismissed', hint: 'IT decided this is safe; never warns' },
};

export default function StatusBadge({ status }) {
  const s = STATUS[status] ?? { icon: '?', label: status, hint: '' };
  return (
    <span className={`status status-${status}`} title={s.hint}>
      <span className="status-dot" aria-hidden="true" />
      <span aria-hidden="true">{s.icon}</span> {s.label}
    </span>
  );
}
