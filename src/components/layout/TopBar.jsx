import { Menu, Moon, Search } from 'lucide-react';
import { formatPercent, formatPrice } from '../../lib/format.js';

export function TopBar({ query, onQueryChange, exchangeRate, searchRef }) {
  return (
    <header className="topbar">
      <button
        className="icon-button"
        aria-label="메뉴"
        type="button"
        disabled
        title="모바일에서는 상단 브랜드 영역으로 메뉴가 축약됩니다."
      >
        <Menu size={20} />
      </button>
      <label className="global-search">
        <Search size={20} />
        <strong>통합검색</strong>
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="ETF, 지수, 테마, 종목, 운용사 검색"
        />
        <kbd>/</kbd>
      </label>
      <div className="market-status" aria-label="환율 상태">
        {exchangeRate?.value ? (
          <>
            <span>{exchangeRate.pair}</span>
            <strong>{formatPrice(exchangeRate.value, 'KRW')}</strong>
            <em className={exchangeRate.changePercent >= 0 ? 'positive' : 'negative'}>
              {formatPercent(exchangeRate.changePercent)}
            </em>
          </>
        ) : (
          <span>환율 데이터 없음</span>
        )}
      </div>
      <div className="top-actions">
        <button
          className="icon-button"
          aria-label="다크 모드"
          type="button"
          disabled
          title="다크 모드는 아직 지원하지 않습니다."
        >
          <Moon size={18} />
        </button>
      </div>
    </header>
  );
}
