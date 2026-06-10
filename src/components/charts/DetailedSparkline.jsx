import { isFiniteNumber } from '../../lib/metrics.js';
import { formatPercent, formatPrice, returnTone } from '../../lib/format.js';
import { MetricTile } from '../common/MetricTile.jsx';

export function DetailedSparkline({ values, currency }) {
  const stats = sparklineStats(values);
  if (!stats) {
    return (
      <div className="performance-visual empty-chart">
        <span className="sparkline-placeholder">성과 흐름 데이터 없음</span>
      </div>
    );
  }

  const points = stats.values.map((value, index) => {
    const x = 4 + (index / (stats.values.length - 1)) * 92;
    const y = 42 - ((value - stats.min) / stats.spread) * 34;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  return (
    <div className="detailed-chart-block">
      <div className="performance-visual detailed">
        <div className="chart-scale" aria-hidden="true">
          <span>{formatPrice(stats.max, currency)}</span>
          <span>{formatPrice(stats.mid, currency)}</span>
          <span>{formatPrice(stats.min, currency)}</span>
        </div>
        <svg className="detailed-sparkline" viewBox="0 0 100 48" aria-label="최근 가격 흐름">
          <line x1="4" y1="8" x2="96" y2="8" />
          <line x1="4" y1="25" x2="96" y2="25" />
          <line x1="4" y1="42" x2="96" y2="42" />
          <polyline points={points} />
          <circle cx="4" cy={42 - ((stats.start - stats.min) / stats.spread) * 34} r="1.8" />
          <circle cx="96" cy={42 - ((stats.end - stats.min) / stats.spread) * 34} r="1.8" />
        </svg>
      </div>
      <div className="chart-stat-grid">
        <MetricTile label="기간" value="최근 30일" />
        <MetricTile label="시작" value={formatPrice(stats.start, currency)} />
        <MetricTile label="최근" value={formatPrice(stats.end, currency)} tone={returnTone(stats.changePercent)} />
        <MetricTile label="구간 변화" value={formatPercent(stats.changePercent)} tone={returnTone(stats.changePercent)} />
      </div>
    </div>
  );
}

function sparklineStats(values) {
  const cleanValues = (values ?? []).filter(isFiniteNumber);
  if (cleanValues.length < 2) return null;
  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  const start = cleanValues[0];
  const end = cleanValues.at(-1);
  return {
    values: cleanValues,
    count: cleanValues.length,
    min,
    max,
    mid: (min + max) / 2,
    spread: max - min || 1,
    start,
    end,
    changePercent: start > 0 ? ((end / start) - 1) * 100 : null,
  };
}
