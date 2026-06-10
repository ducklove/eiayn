import { Plus, Star, X } from 'lucide-react';
import {
  formatAum,
  formatNumber,
  formatPercent,
  formatPlainPercent,
  returnTone,
} from '../../lib/format.js';
import { Sparkline } from '../charts/Sparkline.jsx';

const metricRows = [
  ['AIYN 점수', 'aiynScore', 'score'],
  ['총보수 (연)', 'expenseRatio', 'plainPercent'],
  ['순자산 (AUM)', 'aum', 'aum'],
  ['추적오차 (3년)', 'risk.trackingError3y', 'plainPercent'],
  ['배당수익률 (연)', 'dividendYield', 'plainPercent'],
  ['변동성 (3년 연환산)', 'risk.volatility3yAnnualized', 'plainPercent'],
  ['샤프지수 (3년)', 'risk.sharpe3y', 'number'],
  ['3개월 수익률', 'returns.m3', 'return'],
  ['1년 수익률', 'returns.y1', 'return'],
  ['3년 수익률 (연환산)', 'returns.y3Annualized', 'return'],
  ['5년 수익률 (연환산)', 'returns.y5Annualized', 'return'],
  ['상장일', 'inceptionDate', 'text'],
  ['기초지수', 'benchmarkIndex', 'text'],
];

export function ComparisonGrid({
  selectedEtfs,
  activeId,
  onSelect,
  onRemove,
  favorites,
  toggleFavorite,
  onAddNext,
}) {
  return (
    <section className="comparison-grid" id="basket" aria-labelledby="comparison-title">
      <div className="compare-labels">
        <div className="compare-cell header-cell">
          <h3 id="comparison-title">비교 중인 ETF ({selectedEtfs.length})</h3>
          <p>선택한 상품을 실제 데이터 기준으로 비교합니다.</p>
        </div>
        {metricRows.map(([label]) => (
          <div className="compare-cell metric-label" key={label}>
            {label}
          </div>
        ))}
        <div className="compare-cell metric-label">관심상품</div>
      </div>

      <div className="compare-columns">
        {selectedEtfs.map((etf) => (
          <article
            className={`compare-column ${activeId === etf.id ? 'active' : ''}`}
            key={etf.id}
            onClick={() => onSelect(etf.id)}
          >
            <div className="compare-cell etf-head">
              <label className="checkbox-line" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={activeId === etf.id}
                  onChange={() => onSelect(etf.id)}
                />
                <span>{etf.name}</span>
              </label>
              <button
                className="icon-button small"
                aria-label={`${etf.name} 비교 제거`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(etf.id);
                }}
              >
                <X size={16} />
              </button>
              <p>
                {etf.id} · {etf.market} · {etf.category}
              </p>
            </div>
            {metricRows.map(([label, key, type]) => (
              <div className="compare-cell metric-value" key={`${etf.id}-${label}`}>
                <span>{formatMetric(etf, key, type)}</span>
                {type === 'return' && getPath(etf, key) !== null ? (
                  <Sparkline values={etf.sparkline} />
                ) : null}
              </div>
            ))}
            <div className="compare-cell favorite-cell">
              <button
                className={`favorite-button ${favorites.includes(etf.id) ? 'selected' : ''}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(etf.id);
                }}
              >
                <Star size={16} />
                관심 추가
              </button>
            </div>
          </article>
        ))}
        {selectedEtfs.length < 4 && (
          <button className="add-slot" type="button" onClick={onAddNext}>
            <Plus size={20} />
            ETF 추가
          </button>
        )}
      </div>
    </section>
  );
}

function formatMetric(etf, key, type) {
  const value = getPath(etf, key);
  if (type === 'score') {
    return (
      <div className="score-metric">
        <strong>{value ?? '-'}</strong>
        <span className="score-bars" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <span
              key={index}
              className={
                typeof value === 'number' && index < Math.round(value / 17) ? 'filled' : ''
              }
            />
          ))}
        </span>
      </div>
    );
  }
  if (type === 'plainPercent') return formatPlainPercent(value);
  if (type === 'return')
    return <span className={returnTone(value) ?? ''}>{formatPercent(value)}</span>;
  if (type === 'number') return formatNumber(value);
  if (type === 'aum') return formatAum(value, etf.currency);
  return value ?? '-';
}

function getPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object) ?? null;
}
