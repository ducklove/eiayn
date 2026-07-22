import { useMemo } from 'react';
import { formatAum, formatPercent, formatPlainPercent, returnTone } from '../../lib/format.js';
import { etfDeepLink, handleEtfLinkClick } from '../../lib/links.js';
import { DEFAULT_RANKING_LIMIT, rankEtfsByScore } from '../../lib/ranking.js';

// Full-universe AIYN ranking: same order as the build-time
// data/rankings.json API (src/lib/ranking.js), independent of the current
// search query and filters.
export function AiynRankingView({ etfs, onOpenEtf }) {
  const ranked = useMemo(() => rankEtfsByScore(etfs), [etfs]);
  const scoredCount = useMemo(
    () => etfs.filter((etf) => Number.isFinite(etf?.aiynScore)).length,
    [etfs],
  );
  const apiHref = `${import.meta.env.BASE_URL}data/rankings.json`;

  return (
    <section className="etf-table-block" aria-labelledby="aiyn-ranking-title">
      <div className="section-heading">
        <h3 id="aiyn-ranking-title">AIYN 점수 TOP {ranked.length}</h3>
        <span>
          전체 유니버스 기준이며 검색·필터와 무관합니다. 점수가 없는 ETF는 제외됩니다 (점수 보유{' '}
          {scoredCount}/{etfs.length}종). 행을 누르면 개별 분석이 열립니다.
        </span>
      </div>
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
              <th className="ranking-center-cell">AUM</th>
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
                  {typeof etf.scoreCoverage === 'number'
                    ? `${Math.round(etf.scoreCoverage * 100)}%`
                    : '-'}
                </td>
                <td className="num ranking-center-cell">{formatPlainPercent(etf.expenseRatio)}</td>
                <td className="num ranking-center-cell">{formatPlainPercent(etf.dividendYield)}</td>
                <td className={`num ranking-center-cell ${returnTone(etf.returns?.y1) ?? ''}`}>
                  {formatPercent(etf.returns?.y1)}
                </td>
                <td className="num ranking-center-cell">{formatAum(etf.aum, etf.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!ranked.length && <p className="empty-state">AIYN 점수가 계산된 ETF가 없습니다.</p>}
      </div>
      <p className="ranking-api-note">
        이 랭킹은 매 데이터 갱신마다 JSON으로도 게시됩니다 (상위 {DEFAULT_RANKING_LIMIT}종):{' '}
        <a href={apiHref} target="_blank" rel="noreferrer">
          data/rankings.json
        </a>
      </p>
    </section>
  );
}
