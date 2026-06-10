import { formatPercent } from '../../lib/format.js';
import { etfDeepLink, handleEtfLinkClick } from '../../lib/links.js';

export function SimpleListPanel({ title, items, emptyText, onOpenEtf }) {
  return (
    <section className="bottom-panel">
      <div className="section-heading">
        <h3>{title}</h3>
        <button type="button" disabled title="목록은 선택/관심상품 상태에 따라 자동 갱신됩니다.">더보기</button>
      </div>
      {items.length ? (
        <div className="compact-table">
          <div className="compact-head">
            <span>ETF명</span>
            <span>시장</span>
            <span>자산군</span>
            <span>1년 수익률</span>
          </div>
          {items.slice(0, 5).map((item) => (
            <a
              className="compact-row"
              href={etfDeepLink(item.id)}
              key={item.id}
              onClick={(event) => handleEtfLinkClick(event, item.id, onOpenEtf)}
              aria-label={`${item.shortName} 개별 분석 열기`}
            >
              <strong>{item.shortName}</strong>
              <span>{item.market}</span>
              <span>{item.assetClass}</span>
              <span className={item.returns.y1 >= 0 ? 'positive' : 'negative'}>{formatPercent(item.returns.y1)}</span>
            </a>
          ))}
        </div>
      ) : <p className="empty-state">{emptyText}</p>}
    </section>
  );
}
