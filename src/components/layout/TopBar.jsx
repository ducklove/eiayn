import { useState } from 'react';
import { Menu, Moon, Search, Sun } from 'lucide-react';
import { formatPercent, formatPrice } from '../../lib/format.js';
import { etfDeepLink, handleEtfLinkClick } from '../../lib/links.js';

export function TopBar({
  query,
  onQueryChange,
  exchangeRate,
  searchRef,
  theme,
  onToggleTheme,
  searchResults = [],
  searchResultCount = 0,
  onOpenSearchResult,
}) {
  const isDark = theme === 'dark';
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const hasQuery = query.trim().length > 0;
  const showSearchResults = isSearchOpen && hasQuery;

  const openSearchResult = (id) => {
    setIsSearchOpen(false);
    onOpenSearchResult?.(id);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const firstResult = searchResults[0];
      if (firstResult) openSearchResult(firstResult.id);
    }
    if (event.key === 'Escape') {
      setIsSearchOpen(false);
      event.currentTarget.blur();
    }
  };

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
      <div className="search-shell">
        <label className="global-search" htmlFor="global-search-input">
          <Search size={20} />
          <strong>통합검색</strong>
          <input
            id="global-search-input"
            ref={searchRef}
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            onBlur={() => setIsSearchOpen(false)}
            onKeyDown={handleSearchKeyDown}
            placeholder="ETF, 지수, 테마, 종목, 운용사 검색"
            aria-expanded={showSearchResults}
            aria-controls="global-search-results"
            autoComplete="off"
          />
          <kbd>/</kbd>
        </label>
        {showSearchResults && (
          <div className="search-results-popover" id="global-search-results" role="listbox">
            <div className="search-results-summary">
              <strong>{searchResultCount.toLocaleString('ko-KR')}개 검색됨</strong>
              <span>Enter로 첫 결과 열기</span>
            </div>
            {searchResults.length ? (
              searchResults.map((item) => (
                <a
                  className="search-result-row"
                  href={etfDeepLink(item.id)}
                  key={item.id}
                  role="option"
                  onMouseDown={(event) => {
                    if (
                      event.button === 0 &&
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.shiftKey &&
                      !event.altKey
                    ) {
                      event.preventDefault();
                    }
                  }}
                  onClick={(event) => handleEtfLinkClick(event, item.id, openSearchResult)}
                >
                  <span>
                    <strong>{item.shortName}</strong>
                    <small>
                      {item.id} · {item.market} · {item.provider ?? '-'}
                    </small>
                  </span>
                  <em>{formatPercent(item.changePercent)}</em>
                </a>
              ))
            ) : (
              <p className="search-no-results">검색 조건에 맞는 ETF가 없습니다.</p>
            )}
          </div>
        )}
      </div>
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
          aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          aria-pressed={isDark}
          type="button"
          title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          onClick={onToggleTheme}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
