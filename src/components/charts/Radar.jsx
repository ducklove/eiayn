export function Radar({ factors }) {
  const entries = Object.entries(factors).filter(([, value]) => typeof value === 'number');
  const safeEntries = entries.filter(([label]) => label !== '총보수');
  const displayEntries = safeEntries.length
    ? safeEntries
    : [
        ['단기 수익', 0],
        ['장기 수익', 0],
        ['가치', 0],
        ['안정성', 0],
        ['분산', 0],
        ['효율성', 0],
      ];
  const centerX = 96;
  const centerY = 76;
  const radius = 44;
  const labelRadius = 67;
  const points = displayEntries
    .map(([, value], index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / displayEntries.length;
      const distance = (value / 100) * radius;
      return `${centerX + Math.cos(angle) * distance},${centerY + Math.sin(angle) * distance}`;
    })
    .join(' ');

  return (
    <svg className="radar" viewBox="0 0 192 152" aria-label="AIYN 팩터 레이더">
      {[0.25, 0.5, 0.75, 1].map((scale) => {
        const grid = displayEntries
          .map((_, index) => {
            const angle = -Math.PI / 2 + (index * 2 * Math.PI) / displayEntries.length;
            return `${centerX + Math.cos(angle) * radius * scale},${centerY + Math.sin(angle) * radius * scale}`;
          })
          .join(' ');
        return <polygon key={scale} points={grid} className="radar-grid" />;
      })}
      {displayEntries.map(([label], index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / displayEntries.length;
        return (
          <text
            key={label}
            x={centerX + Math.cos(angle) * labelRadius}
            y={centerY + Math.sin(angle) * labelRadius + 4}
            textAnchor="middle"
          >
            {label}
          </text>
        );
      })}
      <polygon points={points} className="radar-shape" />
    </svg>
  );
}
