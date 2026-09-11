import { useMemo, useState } from 'react';
import { ScoreCoverageBadge } from '../common/ScoreCoverageBadge.jsx';
import { formatAum, formatPercent, formatPlainPercent, returnTone } from '../../lib/format.js';
import { etfDeepLink, handleEtfLinkClick } from '../../lib/links.js';
import { DEFAULT_RANKING_LIMIT, rankEtfsByScore } from '../../lib/ranking.js';

// Full-universe AIYN ranking: same order as the build-time
// data/rankings.json API (src/lib/ranking.js), independent of the current
// search query and filters.
export function AiynRankingView({ etfs, onOpenEtf, filters, onFiltersChange }) {
  const [localFilters, setLocalFilters] = useState({ market: '', assetClass: '', minCoverage: 0 });
  const options = filters ?? localFilters;
  const setOptions = onFiltersChange ?? setLocalFilters;
  const ranked = useMemo(() => rankEtfsByScore(etfs, options), [etfs, options]);
  const scoredCount = useMemo(
    () => etfs.filter((etf) => Number.isFinite(etf?.aiynScore)).length,
    [etfs],
  );
  const apiHref = `${import.meta.env.BASE_URL}data/rankings.json`;

  return (
    <section className="etf-table-block aiyn-ranking-block" aria-labelledby="aiyn-ranking-title">
      <div className="section-heading">
        <h3 id="aiyn-ranking-title">AIYN 점수 TOP {ranked.length}</h3>
        <span>
          점수는 전체 유니버스 기준이며, 아래 조건으로 비교 집단을 좁힐 수 있습니다. 점수가 없는
          ETF는 제외됩니다 (점수 보유 {scoredCount}/{etfs.length}종). 행을 누르면 개별 분석이
          열립니다.
        </span>
      </div>
      <div className="ranking-controls">
        <label>
          비교 시장
          <select
            aria-label="랭킹 비교 시장"
            value={options.market}
            onChange={(event) => setOptions({ ...options, market: event.target.value })}
          >
            <option value="">모든 시장</option>
            {[...new Set(etfs.map((etf) => etf.market).filter(Boolean))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          자산군
          <select
            aria-label="랭킹 자산군"
            value={options.assetClass}
            onChange={(event) => setOptions({ ...options, assetClass: event.target.value })}
          >
            <option value="">모든 자산군</option>
            {[...new Set(etfs.map((etf) => etf.assetClass).filter(Boolean))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          데이터 충족도
          <select
            aria-label="랭킹 최소 충족도"
            value={options.minCoverage}
            onChange={(event) =>
              setOptions({ ...options, minCoverage: Number(event.target.value) })
            }
          >
            <option value={0}>모두 포함</option>
            <option value={0.8}>80% 이상</option>
            <option value={1}>100%</option>
          </select>
        </label>
      </div>
      <p className="ranking-api-note">
        산식 {etfs[0]?.scoreModelVersion ?? '1.0.0'} · 규모 점수와 동점 순위는 공통 통화 USD
        기준입니다. 데이터 충족도가 낮은 ETF는 일부 항목만으로 점수가 계산됩니다.
      </p>
      <div className="table-scroll">
        <table className="etf-table aiyn-ranking-table">
          <thead>
            <tr>
              <th>순위</th>
              <th>ETF</th>
              <th>시장</th>
              <th className="ranking-center-cell">AIYN</th>
              <th className="ranking-center-cell">충족도</th>
              <th className="ranking-center-cell">총보수</th>
              <th className="ranking-center-cell">배당 (연)</th>
              <th className="ranking-center-cell">1년</th>
              <th className="ranking-center-cell">AUM (USD)</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((etf, index) => (
              <tr key={etf.id} onClick={() => onOpenEtf(etf.id)}>
                <td className="num rank-cell">{index + 1}</td>
                <td className="name-cell">
                  <a
                    href={etfDeepLink(etf.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleEtfLinkClick(event, etf.id, onOpenEtf);
                    }}
                  >
                    <strong>{etf.shortName}</strong>
                    <small>
                      {etf.id} · {etf.provider ?? '-'}
                    </small>
                  </a>
                </td>
                <td>{etf.market}</td>
                <td className="num score-cell ranking-center-cell">{etf.aiynScore}</td>
                <td className="num ranking-center-cell">
                  <ScoreCoverageBadge etf={etf} />
                </td>
                <td className="num ranking-center-cell">{formatPlainPercent(etf.expenseRatio)}</td>
                <td className="num ranking-center-cell">{formatPlainPercent(etf.dividendYield)}</td>
                <td className={`num ranking-center-cell ${returnTone(etf.returns?.y1) ?? ''}`}>
                  {formatPercent(etf.returns?.y1)}
                </td>
                <td className="num ranking-center-cell">{formatAum(etf.aumUsd, 'USD')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!ranked.length && <p className="empty-state">AIYN 점수가 계산된 ETF가 없습니다.</p>}
      </div>
      <p className="ranking-api-note">
        전체 ETF 기준 랭킹은 매 데이터 갱신마다 JSON으로도 게시됩니다 (상위 {DEFAULT_RANKING_LIMIT}
        종). 위 비교 조건은 CSV 내보내기에 적용됩니다:{' '}
        <a href={apiHref} target="_blank" rel="noreferrer">
          data/rankings.json
        </a>
      </p>
    </section>
  );
}
