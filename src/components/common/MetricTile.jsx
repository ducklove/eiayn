export function MetricTile({ label, value, tone }) {
  return (
    <div className={`metric-tile ${tone ? `tone-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
