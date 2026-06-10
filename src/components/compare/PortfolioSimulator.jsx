import { useEffect, useState } from 'react';
import { PieChart } from 'lucide-react';
import { buildPortfolioSummary } from '../../lib/portfolio.js';
import { formatNumber, formatPlainPercent } from '../../lib/format.js';

function equalShare(count) {
  return count > 0 ? Math.round(1000 / count) / 10 : 0;
}

function equalWeights(etfs) {
  const share = equalShare(etfs.length);
  return Object.fromEntries(etfs.map((etf) => [etf.id, share]));
}

export function PortfolioSimulator({ selectedEtfs }) {
  const [weights, setWeights] = useState(() => equalWeights(selectedEtfs));
  const [customized, setCustomized] = useState(false);

  // Re-balance defaults when the basket changes: untouched baskets return to an
  // equal split, customized baskets keep edited weights and only new ETFs get
  // the equal-split default.
  useEffect(() => {
    setWeights((current) => {
      const share = equalShare(selectedEtfs.length);
      const next = {};
      let changed = Object.keys(current).length !== selectedEtfs.length;
      for (const etf of selectedEtfs) {
        const keep = customized && etf.id in current;
        next[etf.id] = keep ? current[etf.id] : share;
        if (next[etf.id] !== current[etf.id]) changed = true;
      }
      return changed ? next : current;
    });
  }, [selectedEtfs, customized]);

  const share = equalShare(selectedEtfs.length);
  const weightFor = (id) => weights[id] ?? share;

  const updateWeight = (id, rawValue) => {
    const parsed = Number(rawValue);
    const value = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setCustomized(true);
    setWeights((current) => ({ ...current, [id]: value }));
  };

  const resetWeights = () => {
    setCustomized(false);
    setWeights(equalWeights(selectedEtfs));
  };

  const heading = (
    <div className="section-heading">
      <div className="heading-title">
        <PieChart size={16} />
        <h3 id="portfolio-simulator-title">포트폴리오 조합 시뮬레이터</h3>
      </div>
      <span>비중을 조절해 조합의 합성 지표를 확인하세요.</span>
    </div>
  );

  if (selectedEtfs.length < 2) {
    return (
      <section className="portfolio-simulator" aria-labelledby="portfolio-simulator-title">
        {heading}
        <p className="empty-state">
          ETF를 2개 이상 비교 바구니에 담으면 조합을 시뮬레이션할 수 있습니다.
        </p>
      </section>
    );
  }

  const weightSum = selectedEtfs.reduce((sum, etf) => sum + weightFor(etf.id), 0);
  const roundedSum = Math.round(weightSum * 10) / 10;
  const summary = buildPortfolioSummary(
    selectedEtfs.map((etf) => ({ etf, weight: weightFor(etf.id) })),
  );

  return (
    <section className="portfolio-simulator" aria-labelledby="portfolio-simulator-title">
      {heading}
      <div className="portfolio-weights">
        {selectedEtfs.map((etf) => (
          <label className="portfolio-weight-row" key={etf.id}>
            <span className="portfolio-weight-name" title={etf.name}>
              {etf.shortName}
            </span>
            <span className="portfolio-weight-input">
              <input
                type="number"
                min="0"
                step="5"
                value={weightFor(etf.id)}
                onChange={(event) => updateWeight(etf.id, event.target.value)}
                aria-label={`${etf.shortName} 비중`}
              />
              %
            </span>
          </label>
        ))}
      </div>
      <div className="portfolio-weight-meta">
        <span>
          비중 합계 <b>{formatNumber(roundedSum, 1)}%</b>
        </span>
        {roundedSum !== 100 && (
          <em>합계가 100%가 아니어도 계산에는 자동 정규화한 비중을 사용합니다.</em>
        )}
        <button className="ghost-button slim" type="button" onClick={resetWeights}>
          균등 배분
        </button>
      </div>
      {summary ? (
        <>
          <dl className="portfolio-metrics">
            <MetricItem
              label="합성 총보수"
              metric={summary.expenseRatio}
              render={(value) => formatPlainPercent(value)}
            />
            <MetricItem
              label="합성 배당률"
              metric={summary.dividendYield}
              render={(value) => formatPlainPercent(value)}
            />
            <MetricItem
              label="가중 AIYN 점수"
              metric={summary.aiynScore}
              render={(value) => `${formatNumber(value, 1)}점`}
            />
          </dl>
          <div className="portfolio-breakdowns">
            <BreakdownList title="테마 구성" items={summary.themeBreakdown} />
            <BreakdownList title="시장 구성" items={summary.marketBreakdown} />
          </div>
          <p className="portfolio-caveat">
            단순 가중 평균 집계입니다 (상관관계/리밸런싱 미반영). 수익률 전망이 아닙니다.
          </p>
        </>
      ) : (
        <p className="empty-state">비중을 1개 이상 0보다 크게 입력하면 합성 지표를 계산합니다.</p>
      )}
    </section>
  );
}

function MetricItem({ label, metric, render }) {
  const hasValue = metric.value !== null;
  return (
    <div className="portfolio-metric">
      <dt>{label}</dt>
      <dd>
        <b>{hasValue ? render(metric.value) : '데이터 없음'}</b>
        {hasValue && metric.includedCount < metric.totalCount && (
          <em>
            {metric.includedCount}/{metric.totalCount}종 반영
          </em>
        )}
      </dd>
    </div>
  );
}

function BreakdownList({ title, items }) {
  return (
    <div className="portfolio-breakdown">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <span className="portfolio-breakdown-label" title={item.label}>
              {item.label}
            </span>
            <span className="portfolio-breakdown-bar" aria-hidden="true">
              <i style={{ width: `${Math.min(100, Math.max(0, item.weight))}%` }} />
            </span>
            <b>{formatPlainPercent(item.weight, 1)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
