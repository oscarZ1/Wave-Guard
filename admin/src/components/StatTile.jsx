// Stat tile: label (sentence case) · value · optional caption. `hero` is the one
// number the dashboard leads with.
export default function StatTile({ label, value, caption, hero = false }) {
  return (
    <section className={hero ? 'tile tile-hero' : 'tile'} aria-label={label}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{Number(value ?? 0).toLocaleString()}</div>
      {caption && <div className="tile-caption">{caption}</div>}
    </section>
  );
}
