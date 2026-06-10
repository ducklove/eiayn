import { useEffect, useMemo, useState } from 'react';
import { formatPercent } from '../../lib/format.js';
import { etfDeepLink, handleEtfLinkClick } from '../../lib/links.js';

export function RankingPanel({ filteredEtfs, onOpenEtf }) {
  const [tab, setTab] = useState('전체');
  const marketTabs = useMemo(() => (
    ['전체', ...Array.from(new Set(filteredEtfs.map((item) => item.market).filter(Boolean)))]
  ), [filteredEtfs]);

  useEffect(() => {
    if (!marketTabs.includes(tab)) setTab('전체');
  }, [marketTabs, tab]);

  const ranked = useMemo(() => (
    filteredEtfs
      .filter((item) => tab === '전체' || item.market === tab)
      .slice()
      .sort((a, b) => (b.returns.y1 ?? -Infinity) - (a.returns.y1 ?? -Infinity))
      .slice(0, 5)
  ), [filteredEtfs, tab]);

  return (
    <section className="bottom-panel" id="ranking">
      <div className="section-heading">
        <h3>수익률 랭킹 (1년)</h3>
        <select aria-label="랭킹 기준" disabled title="현재는 TOP 5만 제공합니다."><option>TOP 5</option></select>
      </div>
      <div className="tabs" role="tablist" aria-label="시장 탭">
        {marketTabs.map((item) => (
          <button className={tab === item ? 'active' : ''} type="button" key={item} onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>
      <div className="ranking-list">
        {ranked.map((item, index) => (
          <a
            className="ranking-row"
            href={etfDeepLink(item.id)}
            key={item.id}
            onClick={(event) => handleEtfLinkClick(event, item.id, onOpenEtf)}
            aria-label={`${item.shortName} 개별 분석 열기`}
          >
            <span>{index + 1}</span>
            <strong>{item.shortName}</strong>
            <em>{item.provider}</em>
            <b className={item.returns.y1 >= 0 ? 'positive' : 'negative'}>{formatPercent(item.returns.y1)}</b>
          </a>
        ))}
      </div>
    </section>
  );
}
