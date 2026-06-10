import { formatPercent } from '../../lib/format.js';

export function UniverseStrip({ filteredEtfs, activeEtf, activeId, onSelect }) {
  const candidates = [
    ...(activeEtf ? [activeEtf] : []),
    ...filteredEtfs.filter((item) => item.id !== activeId),
  ].slice(0, 8);

  return (
    <section className="universe-strip">
      <div className="section-heading">
        <h3>ETF 탐색</h3>
        <span>필터 조건에 맞는 ETF를 선택해 개별 분석을 전환하세요.</span>
      </div>
      {candidates.length ? (
        <div className="universe-list">
          {candidates.map((item) => {
            const selected = activeId === item.id;
            return (
              <button
                className={selected ? 'selected' : ''}
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
              >
                <span>{item.shortName}</span>
                <em>{item.category}</em>
                <b className={item.changePercent >= 0 ? 'positive' : 'negative'}>
                  {formatPercent(item.changePercent)}
                </b>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">검색 조건에 맞는 ETF가 없습니다.</p>
      )}
    </section>
  );
}
