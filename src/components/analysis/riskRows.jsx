import { isFiniteNumber } from '../../lib/metrics.js';
import { formatNumber, formatPlainPercent } from '../../lib/format.js';

export function RiskRow({ label, value, tag }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value} {tag ? <span>{tag}</span> : null}
      </dd>
    </div>
  );
}

export function riskMetricRows(etf) {
  const risk = etf.risk ?? {};
  return [
    {
      label: '변동성 (3년 연환산)',
      raw: risk.volatility3yAnnualized,
      value: formatPlainPercent(risk.volatility3yAnnualized),
    },
    {
      label: '최대낙폭 (3년)',
      raw: risk.maxDrawdown3y,
      value: formatPlainPercent(risk.maxDrawdown3y),
    },
    { label: '샤프지수 (3년)', raw: risk.sharpe3y, value: formatNumber(risk.sharpe3y) },
    {
      label: '추적오차 (3년)',
      raw: risk.trackingError3y,
      value: formatPlainPercent(risk.trackingError3y),
    },
    {
      label: '정보비율 (3년)',
      raw: risk.informationRatio3y,
      value: formatNumber(risk.informationRatio3y),
    },
  ].filter((row) => isFiniteNumber(row.raw));
}
