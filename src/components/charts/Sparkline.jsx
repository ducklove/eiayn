export function Sparkline({ values }) {
  const cleanValues = (values ?? []).filter((value) => typeof value === 'number');
  if (cleanValues.length < 2) return <span className="sparkline-placeholder">-</span>;
  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  const spread = max - min || 1;
  const points = cleanValues.map((value, index) => {
    const x = (index / (cleanValues.length - 1)) * 86 + 2;
    const y = 34 - ((value - min) / spread) * 26;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="sparkline" viewBox="0 0 90 38" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}
