import { useEffect, useRef, useState } from 'react';
import { Moon, Search, Sun, X } from 'lucide-react';
import { formatPercent, formatPrice, returnTone } from '../../lib/format.js';
import { etfDeepLink, handleEtfLinkClick } from '../../lib/links.js';

const EXAMPLES = ['KODEX200', '미국 배당', '나스닥 100', '삼성전자'];

export function TopBar({
  query,
  onQueryChange,
  exchangeRate,
  searchRef,
  theme,
  onToggleTheme,
  searchResults = [],
  searchResultCount = 0,
  searchPending = false,
  onOpenSearchResult,
  onShowSearchResults,
}) {
  const isDark = theme === 'dark';
  const inputRef = useRef(null);
  const popupRef = useRef(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selection, setSelection] = useState(null);
  const hasQuery = query.trim().length > 0;
  const activeIndex =
    !searchPending && selection?.query === query
      ? searchResults.findIndex((item) => item.id === selection.id)
      : -1;

  useEffect(() => {
    if (isSearchOpen && activeIndex >= 0) {
      popupRef.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex, isSearchOpen]);

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSelection(null);
  };
  const openSearchResult = (id) => {
    closeSearch();
    onOpenSearchResult?.(id);
  };
  const showAllResults = () => {
    if (!hasQuery) return;
    closeSearch();
    onShowSearchResults?.();
  };
  const changeQuery = (value) => {
    setSelection(null);
    onQueryChange(value);
    setIsSearchOpen(true);
  };
  const handleSearchKeyDown = (event) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsSearchOpen(true);
      if (searchPending || !searchResults.length || !hasQuery) return;
      const nextIndex =
        event.key === 'ArrowDown'
          ? (activeIndex + 1) % searchResults.length
          : activeIndex < 0
            ? searchResults.length - 1
            : (activeIndex - 1 + searchResults.length) % searchResults.length;
      setSelection({ query, id: searchResults[nextIndex].id });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (isSearchOpen && activeIndex >= 0) openSearchResult(searchResults[activeIndex].id);
      else showAllResults();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
    }
  };

  return (
    <header className="topbar">
      <div
        className="search-shell"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) closeSearch();
        }}
      >
        <form
          className="global-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            showAllResults();
          }}
        >
          <Search size={20} aria-hidden="true" />
          <label htmlFor="global-search-input">ETF 검색</label>
          <input
            id="global-search-input"
            ref={(element) => {
              inputRef.current = element;
              if (searchRef) searchRef.current = element;
            }}
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="이름 일부·코드·보유종목 검색"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isSearchOpen && hasQuery}
            aria-controls={isSearchOpen && hasQuery ? 'global-search-results' : undefined}
            aria-activedescendant={
              isSearchOpen && activeIndex >= 0 ? `search-option-${activeIndex}` : undefined
            }
            aria-describedby="global-search-help"
            autoComplete="off"
            enterKeyHint="search"
          />
          {hasQuery && (
            <button
              className="search-clear"
              type="button"
              aria-label="검색어 지우기"
              onClick={() => {
                changeQuery('');
                inputRef.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          )}
          <button className="search-submit" type="submit" disabled={!hasQuery}>
            검색
          </button>
        </form>
        <span className="sr-only" id="global-search-help">
          이름 일부나 여러 단어로 검색하세요. Enter는 전체 결과, 방향키로 선택 후 Enter는 개별
          분석입니다.
        </span>
        {isSearchOpen && (
          <div className="search-results-popover" ref={popupRef}>
            <div className="search-results-summary" role="status">
              <strong>
                {hasQuery
                  ? searchPending
                    ? '검색 중…'
                    : `전체 ETF에서 ${searchResultCount.toLocaleString('ko-KR')}개 검색됨`
                  : '어떤 ETF를 찾으세요?'}
              </strong>
              <span>Enter로 전체 결과 보기</span>
            </div>
            {!hasQuery ? (
              <div className="search-guidance">
                <p>
                  이름의 일부, 종목코드, 운용사, 보유종목을 입력하세요. 띄어쓰기와 영문 대소문자는
                  달라도 됩니다.
                </p>
                <div className="search-examples">
                  {EXAMPLES.map((example) => (
                    <button
                      type="button"
                      key={example}
                      onClick={() => {
                        changeQuery(example);
                        inputRef.current?.focus();
                      }}
                    >
                      {example}
                    </button>
                  ))}
                </div>
                <small>예: 삼성전자 → 삼성전자를 보유한 ETF도 함께 찾습니다.</small>
              </div>
            ) : (
              <>
                <div
                  id="global-search-results"
                  role="listbox"
                  aria-label="ETF 검색 결과"
                  aria-busy={searchPending}
                >
                  {!searchPending &&
                    searchResults.map((item, index) => (
                      <a
                        className="search-result-row"
                        href={etfDeepLink(item.id)}
                        key={item.id}
                        id={`search-option-${index}`}
                        role="option"
                        aria-selected={activeIndex === index}
                        tabIndex={-1}
                        onMouseDown={(event) => {
                          if (
                            event.button === 0 &&
                            !event.metaKey &&
                            !event.ctrlKey &&
                            !event.shiftKey &&
                            !event.altKey
                          )
                            event.preventDefault();
                        }}
                        onClick={(event) => handleEtfLinkClick(event, item.id, openSearchResult)}
                      >
                        <span>
                          <strong>{item.name || item.shortName}</strong>
                          <small>
                            {item.id} · {item.market} · {item.provider ?? '-'}
                          </small>
                          <small className="search-match-reason">{item.matchLabel}</small>
                        </span>
                        <em className={returnTone(item.changePercent) ?? ''}>
                          {formatPercent(item.changePercent)}
                        </em>
                      </a>
                    ))}
                </div>
                {!searchPending && !searchResults.length && (
                  <div className="search-guidance">
                    <p>“{query}”에 맞는 ETF가 없습니다.</p>
                    <small>
                      이름을 짧게 입력하거나 종목코드로 검색해 보세요. 보유종목 검색은 공개된 구성
                      내역에 한정됩니다.
                    </small>
                    <div className="search-examples">
                      {EXAMPLES.slice(0, 3).map((example) => (
                        <button
                          type="button"
                          key={example}
                          onClick={() => {
                            changeQuery(example);
                            inputRef.current?.focus();
                          }}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!searchPending && searchResultCount > 0 && (
                  <button className="search-view-all" type="button" onClick={showAllResults}>
                    검색 결과 {searchResultCount.toLocaleString('ko-KR')}개 전체 보기
                  </button>
                )}
                <p className="search-footnote">
                  전체 시장에서 검색합니다. 전체 결과를 열면 기존 필터가 초기화됩니다. ↑↓ 선택 ·
                  Enter 열기 · Esc 닫기
                </p>
              </>
            )}
          </div>
        )}
      </div>
      <div className="market-status" aria-label="환율 상태">
        {exchangeRate?.value ? (
          <>
            <span>{exchangeRate.pair}</span>
            <strong>{formatPrice(exchangeRate.value, 'KRW')}</strong>
            <em className={returnTone(exchangeRate.changePercent) ?? ''}>
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
          onClick={onToggleTheme}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
