import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  Download,
  Filter,
  LayoutDashboard,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { useEtfData } from './hooks/useEtfData.js';
import { usePersistentState } from './hooks/usePersistentState.js';
import { resolveInitialSelection } from './lib/deepLink.js';
import {
  formatAum,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatPlainPercent,
  formatPrice,
  scoreLabel,
} from './lib/format.js';
import { filterEtfs, getRiskBand, uniqueOptions } from './lib/search.js';

const DEFAULT_FILTERS = {
  market: '시장 전체',
  theme: '테마 전체',
  provider: '운용사 전체',
  risk: '리스크 전체',
};

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

const FACTOR_DESCRIPTIONS = {
  '단기 수익': '최근 30일 가격 변화와 3개월 수익률을 ETF 유니버스 안의 백분위로 비교합니다. 두 기간을 같은 비중으로 반영합니다.',
  '장기 수익': '1년, 3년·5년 연환산 수익률을 ETF 유니버스 안의 백분위로 비교합니다. 1년 수익률 비중이 가장 큽니다.',
  가치: '총보수 점수와 순자산(AUM) 규모 점수를 합친 항목입니다. 비용이 낮고 규모가 클수록 높게 잡힙니다.',
  안정성: '3년 샤프지수, 3년 연환산 변동성, 3년 최대낙폭을 함께 봅니다. 변동성과 낙폭은 낮을수록 유리합니다.',
  분산: '상위 10개 보유종목의 집중도가 낮을수록 높은 점수를 받습니다. 보유종목 데이터가 없으면 이 팩터는 점수 계산에서 제외됩니다.',
  효율성: '낮은 총보수와 추적 안정성(추적오차·정보비율)을 함께 반영합니다. 추적 데이터가 없으면 총보수 중심으로 계산됩니다.',
};

const HOLDING_COLORS = ['#0f3761', '#e06f42', '#2fbf71', '#7b8794', '#f2b84b', '#009b7d', '#4f77be', '#b66dff', '#d44949', '#667588'];

function App() {
  const { data, loading, error, reload } = useEtfData();
  const etfs = data?.etfs ?? [];
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [viewMode, setViewMode] = useState('compare');
  const [favorites, setFavorites] = usePersistentState('eiayn:favorites:v1', []);
  const [recentIds, setRecentIds] = usePersistentState('eiayn:recent:v1', []);
  const [actionNote, setActionNote] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!etfs.length || initialized) return;
    const params = new URLSearchParams(window.location.search);
    const initialSelection = resolveInitialSelection(etfs, params);

    setSelectedIds(initialSelection.selectedIds);
    setActiveId(initialSelection.activeId);
    setViewMode(initialSelection.viewMode);
    setQuery(params.get('q') ?? '');
    setFilters({
      market: params.get('market') ?? DEFAULT_FILTERS.market,
      theme: params.get('theme') ?? DEFAULT_FILTERS.theme,
      provider: params.get('provider') ?? DEFAULT_FILTERS.provider,
      risk: params.get('risk') ?? DEFAULT_FILTERS.risk,
    });
    if (initialSelection.requestedCode && !initialSelection.matchedCodeId) {
      setActionNote(`${initialSelection.requestedCode} 코드를 찾지 못해 기본 ETF를 표시합니다.`);
    }
    setInitialized(true);
  }, [etfs, initialized]);

  useEffect(() => {
    if (!activeId || !etfs.some((etf) => etf.id === activeId)) return;
    setRecentIds((current) => [activeId, ...current.filter((id) => id !== activeId)].slice(0, 8));
  }, [activeId, etfs, setRecentIds]);

  const filteredEtfs = useMemo(() => filterEtfs(etfs, query, filters), [etfs, query, filters]);
  const selectedEtfs = useMemo(() => (
    selectedIds.map((id) => etfs.find((etf) => etf.id === id)).filter(Boolean)
  ), [selectedIds, etfs]);
  const selectedEtf = etfs.find((etf) => etf.id === activeId) ?? selectedEtfs[0] ?? etfs[0];
  const favoriteEtfs = etfs.filter((etf) => favorites.includes(etf.id));
  const recentEtfs = recentIds.map((id) => etfs.find((etf) => etf.id === id)).filter(Boolean);
  const isAnalysisView = viewMode === 'analysis';

  const filterOptions = useMemo(() => ({
    markets: uniqueOptions(etfs, 'market', '시장 전체'),
    themes: uniqueOptions(etfs, 'theme', '테마 전체'),
    providers: uniqueOptions(etfs, 'provider', '운용사 전체'),
    risks: ['리스크 전체', '낮음', '보통', '높음', '데이터 없음'],
  }), [etfs]);

  const addNext = () => {
    const next = filteredEtfs.find((etf) => !selectedIds.includes(etf.id));
    if (!next) {
      setActionNote('추가할 ETF가 없습니다. 검색 조건을 조정해보세요.');
      return;
    }
    const nextIds = [...selectedIds, next.id].slice(-4);
    setSelectedIds(nextIds);
    setActiveId(next.id);
    setViewMode('compare');
    setActionNote(`${next.shortName}을 비교 바구니에 추가했습니다.`);
  };

  const openAnalysis = (id) => {
    const next = etfs.find((etf) => etf.id === id);
    if (!next) return;
    setActiveId(id);
    setViewMode('analysis');
    setActionNote(`${next.shortName} 개별 분석 화면을 열었습니다.`);
    writeAnalysisUrl(id);
  };

  const showCompare = () => {
    setViewMode('compare');
    setActionNote('ETF 비교 화면으로 돌아왔습니다.');
    writeCompareUrl(selectedIds, activeId);
  };

  const showActiveAnalysis = () => {
    openAnalysis(selectedEtf.id);
  };

  const selectFirstResult = () => {
    const next = filteredEtfs.find((etf) => etf.id !== activeId) ?? filteredEtfs[0];
    if (!next) {
      setActionNote('선택할 ETF가 없습니다. 검색 조건을 조정해보세요.');
      return;
    }
    openAnalysis(next.id);
  };

  const removeEtf = (id) => {
    if (selectedIds.length <= 1) {
      setActionNote('비교표에는 최소 1개의 ETF가 필요합니다.');
      return;
    }
    const nextIds = selectedIds.filter((selectedId) => selectedId !== id);
    setSelectedIds(nextIds);
    if (activeId === id) setActiveId(nextIds[0]);
  };

  const toggleFavorite = (id) => {
    setFavorites((current) => (
      current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id]
    ));
  };

  const clearFilters = () => {
    setQuery('');
    setFilters(DEFAULT_FILTERS);
    setActionNote('검색 조건을 초기화했습니다.');
  };

  const exportCsv = () => {
    const exportEtfs = isAnalysisView ? [selectedEtf] : selectedEtfs;
    const rows = exportEtfs.map((etf) => ({
      id: etf.id,
      ticker: etf.ticker,
      name: etf.name,
      market: etf.market,
      currency: etf.currency,
      price: etf.price,
      changePercent: etf.changePercent,
      aiynScore: etf.aiynScore,
      expenseRatio: etf.expenseRatio,
      aum: etf.aum,
      dividendYield: etf.dividendYield,
      return1y: etf.returns.y1,
      volatility3y: etf.risk.volatility3yAnnualized,
      maxDrawdown3y: etf.risk.maxDrawdown3y,
      sharpe3y: etf.risk.sharpe3y,
      quoteAsOf: etf.dataQuality.quoteAsOf,
    }));
    const headers = Object.keys(rows[0] ?? {});
    if (!headers.length) return;
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
    ].join('\n');
    const prefix = isAnalysisView ? selectedEtf.id : 'compare';
    downloadFile(`eiayn-${prefix}-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
    setActionNote(isAnalysisView ? `${selectedEtf.shortName} 분석 데이터를 CSV로 내보냈습니다.` : '현재 비교 바구니를 CSV로 내보냈습니다.');
  };

  const shareState = async () => {
    const params = new URLSearchParams();
    if (isAnalysisView && selectedEtf?.id) {
      params.set('code', selectedEtf.id);
    } else {
      if (selectedIds.length) params.set('compare', selectedIds.join(','));
      if (activeId) params.set('active', activeId);
    }
    if (query) params.set('q', query);
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== DEFAULT_FILTERS[key]) params.set(key, value);
    }
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', url);

    try {
      if (navigator.share) {
        await navigator.share({ title: 'ETF is All You Need', url });
        setActionNote('공유 링크를 만들었습니다.');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setActionNote('공유 링크를 복사했습니다.');
      } else {
        setActionNote('공유 링크를 주소창에 반영했습니다.');
      }
    } catch {
      setActionNote('공유 링크를 주소창에 반영했습니다. 복사 권한은 브라우저에서 허용되지 않았습니다.');
    }
  };

  if (loading || !initialized) {
    return <StatusScreen title="ETF 데이터를 불러오는 중입니다" message="빌드 시 생성된 최신 스냅샷을 확인하고 있습니다." />;
  }

  if (error) {
    return (
      <StatusScreen
        title="데이터를 불러오지 못했습니다"
        message={error.message}
        action={<button className="primary-button" type="button" onClick={reload}>다시 시도</button>}
      />
    );
  }

  return (
    <div className="app-shell" id="dashboard">
      <Sidebar
        selectedIds={selectedIds}
        favorites={favoriteEtfs}
        recentEtfs={recentEtfs}
        generatedAt={data.generatedAt}
        viewMode={viewMode}
        onShowCompare={showCompare}
        onShowAnalysis={showActiveAnalysis}
        onOpenEtf={openAnalysis}
      />
      <div className="main-shell">
        <TopBar query={query} onQueryChange={setQuery} exchangeRate={data.exchangeRates?.usdKrw} />
        <main className={`content-grid ${isAnalysisView ? 'single-analysis' : ''}`}>
          <div className={`workspace ${isAnalysisView ? 'analysis-workspace' : ''}`}>
            <WorkspaceHeader
              viewMode={viewMode}
              selectedEtf={selectedEtf}
              selectedIds={selectedIds}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              onShowCompare={showCompare}
              onShowAnalysis={showActiveAnalysis}
              onAddNext={addNext}
              onSelectFirstResult={selectFirstResult}
              onClearFilters={clearFilters}
              filters={filters}
              setFilters={setFilters}
              filterOptions={filterOptions}
              resultCount={filteredEtfs.length}
              actionNote={actionNote}
              setActionNote={setActionNote}
              onExport={exportCsv}
              onShare={shareState}
              onGuide={() => setShowGuide(true)}
            />
            {isAnalysisView ? (
              <EtfAnalysisDashboard selectedEtf={selectedEtf} favorites={favorites} toggleFavorite={toggleFavorite} />
            ) : (
              <ComparisonGrid
                selectedEtfs={selectedEtfs}
                activeId={selectedEtf.id}
                onSelect={setActiveId}
                onRemove={removeEtf}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                onAddNext={addNext}
              />
            )}
            <UniverseStrip
              filteredEtfs={filteredEtfs}
              activeEtf={selectedEtf}
              activeId={selectedEtf.id}
              onSelect={openAnalysis}
            />
            <div className="bottom-grid">
              <RankingPanel filteredEtfs={filteredEtfs.length ? filteredEtfs : etfs} onOpenEtf={openAnalysis} />
              <SimpleListPanel title="최근 조회" items={recentEtfs} emptyText="아직 조회한 ETF가 없습니다." onOpenEtf={openAnalysis} />
              <SimpleListPanel title="관심상품" items={favoriteEtfs} emptyText="별 버튼으로 관심상품을 추가하세요." onOpenEtf={openAnalysis} />
            </div>
          </div>
          {!isAnalysisView && <AnalysisPanel selectedEtf={selectedEtf} favorites={favorites} toggleFavorite={toggleFavorite} />}
        </main>
        <footer className="site-footer">
          <span>마지막 업데이트: {formatDateTime(data.generatedAt)} KST</span>
          <span>데이터 출처: K-ETF, Yahoo Finance, StockAnalysis</span>
          <a href="#risk">투자 유의 고지</a>
        </footer>
      </div>
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}

function StatusScreen({ title, message, action }) {
  return (
    <div className="status-screen">
      <div className="status-panel">
        <div className="brand-mark">AI</div>
        <h1>{title}</h1>
        <p>{message}</p>
        {action}
      </div>
    </div>
  );
}

function Sidebar({ selectedIds, favorites, recentEtfs, generatedAt, viewMode, onShowCompare, onShowAnalysis, onOpenEtf }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">AI</div>
        <div>
          <h1>ETF is All You Need</h1>
          <span>ETF 평가 터미널</span>
        </div>
      </div>

      <nav className="side-nav" aria-label="주요 메뉴">
        <a className={viewMode === 'compare' ? 'active' : ''} href="#dashboard" onClick={(event) => { event.preventDefault(); onShowCompare(); }}><LayoutDashboard size={18} />대시보드</a>
        <a className={viewMode === 'analysis' ? 'active' : ''} href="#model" onClick={(event) => { event.preventDefault(); onShowAnalysis(); }}><WalletCards size={18} />ETF 분석</a>
        <a href="#model"><ShieldCheck size={18} />평가 모델</a>
        <a href="#ranking"><TrendingUp size={18} />수익률 랭킹</a>
        <a href="#search"><Search size={18} />ETF 검색</a>
        <a href="#holdings"><SlidersHorizontal size={18} />구성종목 검색</a>
        <a href="#favorites"><Star size={18} />관심상품</a>
        <a href="#model"><BriefcaseBusiness size={18} />선택 ETF <strong>{selectedIds.length}</strong></a>
        <a href="#risk"><Settings size={18} />투자 유의</a>
      </nav>

      <section className="watchlist" id="favorites" aria-labelledby="watchlist-title">
        <div className="section-heading">
          <h2 id="watchlist-title">관심상품 ({favorites.length})</h2>
          <button type="button" disabled title="관심상품은 각 ETF의 별 버튼으로 관리합니다.">편집</button>
        </div>
        <div className="watchlist-items">
          {favorites.slice(0, 6).map((item) => (
            <a className="watch-row" href={etfDeepLink(item.id)} key={item.id} onClick={(event) => handleEtfLinkClick(event, item.id, onOpenEtf)}>
              <span className="dot" />
              <div>
                <strong>{item.shortName}</strong>
                <small>{item.id}</small>
              </div>
              <p>
                {formatPrice(item.price, item.currency)}
                <span className={item.changePercent >= 0 ? 'positive' : 'negative'}>{formatPercent(item.changePercent)}</span>
              </p>
            </a>
          ))}
          {!favorites.length && <p className="empty-side">관심상품이 없습니다.</p>}
        </div>
      </section>

      <section className="recent-mini" aria-labelledby="recent-title">
        <div className="section-heading">
          <h2 id="recent-title">최근 조회</h2>
          <button type="button" disabled title="최근 조회는 ETF 선택 시 자동 기록됩니다.">더보기</button>
        </div>
        {recentEtfs.slice(0, 3).map((item) => (
          <a className="recent-row" href={etfDeepLink(item.id)} key={item.id} onClick={(event) => handleEtfLinkClick(event, item.id, onOpenEtf)}>
            <strong>{item.shortName}</strong>
            <span>{item.provider}</span>
          </a>
        ))}
        {!recentEtfs.length && <p className="empty-side">조회 기록이 없습니다.</p>}
      </section>

      <div className="data-note">
        <span>출처: K-ETF, Yahoo Finance, StockAnalysis</span>
        <span>마지막 업데이트: {formatDateTime(generatedAt)} KST</span>
      </div>
    </aside>
  );
}

function TopBar({ query, onQueryChange, exchangeRate }) {
  return (
    <header className="topbar">
      <button className="icon-button" aria-label="메뉴" type="button" disabled title="모바일에서는 상단 브랜드 영역으로 메뉴가 축약됩니다.">
        <Menu size={20} />
      </button>
      <label className="global-search">
        <Search size={20} />
        <strong>통합검색</strong>
        <input
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
        <button className="icon-button" aria-label="다크 모드" type="button" disabled title="다크 모드는 아직 지원하지 않습니다."><Moon size={18} /></button>
        <button className="icon-button" aria-label="알림" type="button" disabled title="알림은 로그인 기능이 없어 지원하지 않습니다."><Bell size={18} /></button>
        <button className="icon-button" aria-label="도움말" type="button" disabled title="사용 가이드는 화면의 사용 가이드 버튼을 이용하세요."><CircleHelp size={18} /></button>
      </div>
    </header>
  );
}

function WorkspaceHeader({
  viewMode,
  selectedEtf,
  selectedIds,
  favorites,
  toggleFavorite,
  onShowCompare,
  onShowAnalysis,
  onAddNext,
  onSelectFirstResult,
  onClearFilters,
  filters,
  setFilters,
  filterOptions,
  resultCount,
  actionNote,
  setActionNote,
  onExport,
  onShare,
  onGuide,
}) {
  const isAnalysisView = viewMode === 'analysis';

  return (
    <div className="workspace-header" id="compare">
      <div className="title-block">
        <div>
          <h2>{isAnalysisView ? 'ETF 개별 분석' : 'ETF 비교'}</h2>
          <p>
            {isAnalysisView
              ? `${selectedEtf.name}의 비용, 성과, 위험, 보유종목을 한 화면에서 확인합니다.`
              : '총보수, 순자산, 추적오차, 배당, 변동성을 실제 스냅샷 기준으로 비교합니다.'}
          </p>
        </div>
      </div>

      <div className="workspace-toolbar">
        <div className="view-switch" role="tablist" aria-label="화면 전환">
          <button className={viewMode === 'compare' ? 'active' : ''} type="button" role="tab" aria-selected={viewMode === 'compare'} onClick={onShowCompare}>
            <WalletCards size={16} />
            비교 화면
            <span>{selectedIds.length}/4</span>
          </button>
          <button className={viewMode === 'analysis' ? 'active' : ''} type="button" role="tab" aria-selected={viewMode === 'analysis'} onClick={onShowAnalysis}>
            <ShieldCheck size={16} />
            개별 분석
          </button>
        </div>

        <div className="workspace-actions">
          <button className="guide-button" type="button" onClick={onGuide}>
            <BookOpenCheck size={16} />
            사용 가이드
          </button>
        <button className={`ghost-button ${favorites.includes(selectedEtf.id) ? 'selected-action' : ''}`} type="button" onClick={() => toggleFavorite(selectedEtf.id)}>
          <Star size={17} />
          관심상품
        </button>
        <button className="ghost-button" type="button" onClick={onExport}>
          <Download size={17} />
          {isAnalysisView ? '분석 내보내기' : '비교 내보내기'}
        </button>
        <button className="ghost-button" type="button" onClick={onShare}>
          <Share2 size={17} />
          공유
        </button>
        <button className="primary-button" type="button" onClick={isAnalysisView ? onShowCompare : onShowAnalysis}>
          {isAnalysisView ? '비교로 돌아가기' : '분석 보기'}
        </button>
        </div>
      </div>

      <div className="filters" id="search">
        <button className="filter-main" type="button" onClick={onClearFilters}>
          <Filter size={17} />
          ETF 상품 검색 필터
        </button>
        <FilterSelect label="시장" value={filters.market} options={filterOptions.markets} onChange={(value) => setFilters((current) => ({ ...current, market: value }))} />
        <FilterSelect label="테마" value={filters.theme} options={filterOptions.themes} onChange={(value) => setFilters((current) => ({ ...current, theme: value }))} />
        <FilterSelect label="운용사" value={filters.provider} options={filterOptions.providers} onChange={(value) => setFilters((current) => ({ ...current, provider: value }))} />
        <FilterSelect label="리스크" value={filters.risk} options={filterOptions.risks} onChange={(value) => setFilters((current) => ({ ...current, risk: value }))} />
        <button className="ghost-button slim" type="button" onClick={onClearFilters}>
          <RefreshCw size={15} />
          초기화
        </button>
        <button className="ghost-button slim" type="button" onClick={onSelectFirstResult}>
          <Plus size={15} />
          결과 열기
        </button>
        {!isAnalysisView && (
          <button className="ghost-button slim" type="button" onClick={onAddNext}>
            <Plus size={15} />
            비교 추가
          </button>
        )}
        <span className="result-count">{resultCount}개 검색됨</span>
      </div>

      {actionNote && (
        <div className="action-note" role="status">
          <ShieldCheck size={16} />
          {actionNote}
          <button type="button" onClick={() => setActionNote('')} aria-label="알림 닫기"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <ChevronDown size={16} />
    </label>
  );
}

function InfoPopover({ title, children }) {
  return (
    <details className="info-popover">
      <summary aria-label={title}>
        <CircleHelp size={15} />
      </summary>
      <div className="popover-panel">
        <strong>{title}</strong>
        {children}
      </div>
    </details>
  );
}

function EtfAnalysisDashboard({ selectedEtf, favorites, toggleFavorite }) {
  const holdings = selectedEtf.holdings ?? [];
  const topHoldings = holdings.slice(0, 10);
  const holdingChart = buildHoldingChart(topHoldings);
  const factorEntries = Object.entries(selectedEtf.scoreBreakdown ?? {}).filter(([label, value]) => label !== '총보수' && typeof value === 'number');
  const riskRows = riskMetricRows(selectedEtf);
  const m3Tone = returnTone(selectedEtf.returns.m3);
  const y1Tone = returnTone(selectedEtf.returns.y1);
  const y3Tone = returnTone(selectedEtf.returns.y3Annualized);
  const y5Tone = returnTone(selectedEtf.returns.y5Annualized);

  return (
    <section className="single-etf-dashboard" id="model" aria-labelledby="single-analysis-title">
      <div className="single-hero">
        <div className="single-identity">
          <div className="eyebrow-line">
            <span>{selectedEtf.market}</span>
            <span>{selectedEtf.assetClass}</span>
            <span>{selectedEtf.category}</span>
          </div>
          <h2 id="single-analysis-title">{selectedEtf.name}</h2>
          <p>{selectedEtf.id} · {selectedEtf.provider ?? '운용사 데이터 없음'} · {selectedEtf.benchmarkIndex ?? '기초지수 데이터 없음'}</p>
          <div className="quote-strip">
            <div>
              <span>현재가</span>
              <strong>{formatPrice(selectedEtf.price, selectedEtf.currency)}</strong>
            </div>
            <em className={selectedEtf.changePercent >= 0 ? 'positive' : 'negative'}>
              {formatPercent(selectedEtf.changePercent)} {selectedEtf.changePercent >= 0 ? '▲' : '▼'}
            </em>
            <small>시세 기준: {formatDateTime(selectedEtf.dataQuality.quoteAsOf)} KST</small>
          </div>
        </div>

        <div className="single-score-panel">
          <div className="score-main">
            <span>AIYN 점수</span>
            <strong>{selectedEtf.aiynScore ?? '-'}<small>/100</small></strong>
            <b>{scoreLabel(selectedEtf.aiynScore)}</b>
          </div>
          <Radar factors={selectedEtf.scoreBreakdown ?? {}} />
        </div>
      </div>

      <div className="metric-tile-grid">
        <MetricTile label="총보수 (연)" value={formatPlainPercent(selectedEtf.expenseRatio)} tone="cost" />
        <MetricTile label="순자산 (AUM)" value={formatAum(selectedEtf.aum, selectedEtf.currency)} />
        <MetricTile label="배당수익률 (연)" value={formatPlainPercent(selectedEtf.dividendYield)} />
        <MetricTile label="상장일" value={selectedEtf.inceptionDate ?? '-'} />
        <MetricTile label="3개월 수익률" value={formatPercent(selectedEtf.returns.m3)} tone={m3Tone} />
        <MetricTile label="1년 수익률" value={formatPercent(selectedEtf.returns.y1)} tone={y1Tone} />
        <MetricTile label="3년 연환산" value={formatPercent(selectedEtf.returns.y3Annualized)} tone={y3Tone} />
        <MetricTile label="5년 연환산" value={formatPercent(selectedEtf.returns.y5Annualized)} tone={y5Tone} />
      </div>

      <div className="analysis-main-grid">
        <section className="analysis-card performance-card">
          <div className="section-heading">
            <h3>성과 흐름</h3>
            <span>최근 30일 · 조정가격 기반</span>
          </div>
          <DetailedSparkline values={selectedEtf.sparkline} currency={selectedEtf.currency} />
          <div className="return-grid">
            <MetricTile label="3개월" value={formatPercent(selectedEtf.returns.m3)} tone={m3Tone} />
            <MetricTile label="1년" value={formatPercent(selectedEtf.returns.y1)} tone={y1Tone} />
            <MetricTile label="3년" value={formatPercent(selectedEtf.returns.y3Annualized)} tone={y3Tone} />
            <MetricTile label="5년" value={formatPercent(selectedEtf.returns.y5Annualized)} tone={y5Tone} />
          </div>
        </section>

        <section className="analysis-card factor-card">
          <div className="section-heading">
            <div className="heading-title">
              <h3>AIYN 팩터</h3>
              <InfoPopover title="AIYN 팩터란?">
                <p>AIYN 점수는 비용, 규모, 단기 수익, 장기 수익, 위험조정, 추종 안정성, 분산도를 0-100으로 정규화한 뒤 데이터가 있는 항목끼리 가중 평균합니다.</p>
                <p>데이터가 없는 팩터는 0점 처리하지 않고 계산에서 제외한 뒤 남은 가중치를 재배분합니다.</p>
              </InfoPopover>
            </div>
            <span>0-100 정규화</span>
          </div>
          <div className="factor-list">
            {factorEntries.map(([label, value]) => (
              <details className="factor-row" key={label}>
                <summary>
                  <span>{label}</span>
                  <div className="factor-bar" aria-hidden="true"><i style={{ width: `${value}%` }} /></div>
                  <strong>{value}</strong>
                </summary>
                <p>{FACTOR_DESCRIPTIONS[label] ?? '해당 팩터는 수집된 실제 지표를 전체 ETF 유니버스 기준으로 정규화한 값입니다.'}</p>
              </details>
            ))}
          </div>
        </section>

        {riskRows.length ? (
          <section className="analysis-card">
            <div className="section-heading">
              <h3>위험 지표</h3>
              <span>{getRiskBand(selectedEtf)}</span>
            </div>
            <dl className="detail-list">
              {riskRows.map((row) => <RiskRow key={row.label} label={row.label} value={row.value} />)}
            </dl>
          </section>
        ) : null}

        <section className="analysis-card holdings-card" id="holdings">
          <div className="section-heading">
            <h3>포트폴리오 구성</h3>
            <span>상위 {Math.min(topHoldings.length, 10)}개</span>
          </div>
          {topHoldings.length ? (
            <div className="portfolio-wide-layout">
              <div className="donut large" style={{ '--donut': holdingChart.stops.join(', ') }} aria-label="상위 보유종목 비중 도넛 차트" />
              <div className="wide-holdings">
                {topHoldings.map((holding, index) => (
                  <div className="wide-holding-row" key={`${holding.ticker}-${holding.name}-${index}`}>
                    <span style={{ '--dot-color': HOLDING_COLORS[index % HOLDING_COLORS.length] }}>{index + 1}</span>
                    <strong>{holding.name}</strong>
                    <em>{holding.ticker ?? '-'}</em>
                    <b>{formatPlainPercent(holding.weight)}</b>
                  </div>
                ))}
                <div className="wide-holding-row muted">
                  <span style={{ '--dot-color': '#c9d1d9' }} />
                  <strong>기타</strong>
                  <em />
                  <b>{formatPlainPercent(holdingChart.otherWeight)}</b>
                </div>
              </div>
            </div>
          ) : <p className="empty-state">보유종목 데이터 없음</p>}
        </section>

        <section className="analysis-card risk-note single-risk-note" id="risk">
          <AlertTriangle size={18} />
          <div>
            <h3>투자 유의 고지</h3>
            <p>본 화면은 공개 데이터 스냅샷을 정리한 정보 제공용 도구이며 투자 조언이 아닙니다.</p>
            <p>가격·환율·보유종목은 출처 갱신 시점과 지연에 따라 실제 거래 정보와 차이가 날 수 있습니다.</p>
            <p>투자 판단의 최종 책임은 투자자 본인에게 있습니다.</p>
          </div>
        </section>
      </div>

      <button className={`floating-favorite ${favorites.includes(selectedEtf.id) ? 'selected' : ''}`} type="button" onClick={() => toggleFavorite(selectedEtf.id)}>
        <Star size={16} />
        관심상품
      </button>
    </section>
  );
}

function MetricTile({ label, value, tone }) {
  return (
    <div className={`metric-tile ${tone ? `tone-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function returnTone(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value >= 0 ? 'positive' : 'negative';
}

function ComparisonGrid({ selectedEtfs, activeId, onSelect, onRemove, favorites, toggleFavorite, onAddNext }) {
  return (
    <section className="comparison-grid" id="basket" aria-labelledby="comparison-title">
      <div className="compare-labels">
        <div className="compare-cell header-cell">
          <h3 id="comparison-title">비교 중인 ETF ({selectedEtfs.length})</h3>
          <p>선택한 상품을 실제 데이터 기준으로 비교합니다.</p>
        </div>
        {metricRows.map(([label]) => <div className="compare-cell metric-label" key={label}>{label}</div>)}
        <div className="compare-cell metric-label">관심상품</div>
      </div>

      <div className="compare-columns">
        {selectedEtfs.map((etf) => (
          <article className={`compare-column ${activeId === etf.id ? 'active' : ''}`} key={etf.id} onClick={() => onSelect(etf.id)}>
            <div className="compare-cell etf-head">
              <label className="checkbox-line" onClick={(event) => event.stopPropagation()}>
                <input type="checkbox" checked={activeId === etf.id} onChange={() => onSelect(etf.id)} />
                <span>{etf.name}</span>
              </label>
              <button className="icon-button small" aria-label={`${etf.name} 비교 제거`} type="button" onClick={(event) => { event.stopPropagation(); onRemove(etf.id); }}>
                <X size={16} />
              </button>
              <p>{etf.id} · {etf.market} · {etf.category}</p>
            </div>
            {metricRows.map(([label, key, type]) => (
              <div className="compare-cell metric-value" key={`${etf.id}-${label}`}>
                <span>{formatMetric(etf, key, type)}</span>
                {type === 'return' && getPath(etf, key) !== null ? <Sparkline values={etf.sparkline} /> : null}
              </div>
            ))}
            <div className="compare-cell favorite-cell">
              <button className={`favorite-button ${favorites.includes(etf.id) ? 'selected' : ''}`} type="button" onClick={(event) => { event.stopPropagation(); toggleFavorite(etf.id); }}>
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

function AnalysisPanel({ selectedEtf, favorites, toggleFavorite }) {
  const holdings = selectedEtf.holdings ?? [];
  const holdingChart = buildHoldingChart(holdings.slice(0, 5));
  const riskRows = riskMetricRows(selectedEtf);

  return (
    <aside className="analysis-panel" id="model">
      <div className="panel-title">
        <span>선택된 ETF 분석</span>
        <button className="icon-button small" type="button" disabled title="패널 접기는 아직 지원하지 않습니다."><ChevronDown size={16} /></button>
      </div>

      <section className="selected-summary">
        <div className="summary-title">
          <div>
            <h2>{selectedEtf.name}</h2>
            <p>{selectedEtf.id} · {selectedEtf.market} · {selectedEtf.assetClass} · {selectedEtf.category}</p>
          </div>
          <button className={`star-icon ${favorites.includes(selectedEtf.id) ? 'selected' : ''}`} type="button" onClick={() => toggleFavorite(selectedEtf.id)} aria-label="관심상품 토글">
            <Star size={20} />
          </button>
        </div>
        <div className="quote-line">
          <div>
            <span>현재가</span>
            <strong>{formatPrice(selectedEtf.price, selectedEtf.currency)}</strong>
          </div>
          <em className={selectedEtf.changePercent >= 0 ? 'positive' : 'negative'}>
            {formatPercent(selectedEtf.changePercent)} ({selectedEtf.changePercent >= 0 ? '▲' : '▼'})
          </em>
        </div>
        <p className="asof-note">시세 기준: {formatDateTime(selectedEtf.dataQuality.quoteAsOf)} KST</p>
      </section>

      <section className="score-card">
        <div className="score-main">
          <span>AIYN 점수</span>
          <strong>{selectedEtf.aiynScore ?? '-'}<small>/100</small></strong>
          <b>{scoreLabel(selectedEtf.aiynScore)}</b>
        </div>
        <Radar factors={selectedEtf.scoreBreakdown ?? {}} />
      </section>

      <section className="portfolio-block" id="holdings">
        <div className="section-heading">
          <h3>포트폴리오 구성 (상위 5)</h3>
          <button type="button" disabled title="전체 보유종목 표는 아직 제공하지 않습니다.">더보기</button>
        </div>
        {holdings.length ? (
          <div className="portfolio-body">
            <div className="donut" style={{ '--donut': holdingChart.stops.join(', ') }} aria-label="구성종목 비중 도넛 차트" />
            <div className="holding-list">
              {holdings.slice(0, 5).map((holding, index) => (
                <div className="holding-row" key={`${holding.ticker}-${holding.name}`}>
                  <span style={{ '--dot-color': HOLDING_COLORS[index % HOLDING_COLORS.length] }} />
                  <strong>{holding.name}</strong>
                  <em>{formatPlainPercent(holding.weight)}</em>
                </div>
              ))}
              <div className="holding-row muted">
                <span style={{ '--dot-color': '#c9d1d9' }} />
                <strong>기타</strong>
                <em>{formatPlainPercent(holdingChart.otherWeight)}</em>
              </div>
            </div>
          </div>
        ) : <p className="empty-state">보유종목 데이터 없음</p>}
      </section>

      {riskRows.length ? (
        <section className="risk-block">
          <h3>위험 지표</h3>
          <dl>
            {riskRows.map((row, index) => <RiskRow key={row.label} label={row.label} value={row.value} tag={index === 0 ? getRiskBand(selectedEtf) : undefined} />)}
          </dl>
        </section>
      ) : null}

      <section className="risk-note" id="risk">
        <AlertTriangle size={18} />
        <div>
          <h3>투자 유의 고지</h3>
          <p>본 화면은 공개 데이터 스냅샷을 정리한 정보 제공용 도구이며 투자 조언이 아닙니다.</p>
          <p>가격·환율·보유종목은 출처 갱신 시점과 지연에 따라 실제 거래 정보와 차이가 날 수 있습니다.</p>
          <p>투자 판단의 최종 책임은 투자자 본인에게 있습니다.</p>
        </div>
      </section>
    </aside>
  );
}

function RiskRow({ label, value, tag }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value} {tag ? <span>{tag}</span> : null}</dd>
    </div>
  );
}

function riskMetricRows(etf) {
  const risk = etf.risk ?? {};
  return [
    { label: '변동성 (3년 연환산)', raw: risk.volatility3yAnnualized, value: formatPlainPercent(risk.volatility3yAnnualized) },
    { label: '최대낙폭 (3년)', raw: risk.maxDrawdown3y, value: formatPlainPercent(risk.maxDrawdown3y) },
    { label: '샤프지수 (3년)', raw: risk.sharpe3y, value: formatNumber(risk.sharpe3y) },
    { label: '추적오차 (3년)', raw: risk.trackingError3y, value: formatPlainPercent(risk.trackingError3y) },
    { label: '정보비율 (3년)', raw: risk.informationRatio3y, value: formatNumber(risk.informationRatio3y) },
  ].filter((row) => isFiniteValue(row.raw));
}

function UniverseStrip({ filteredEtfs, activeEtf, activeId, onSelect }) {
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
              <button className={selected ? 'selected' : ''} key={item.id} type="button" onClick={() => {
                onSelect(item.id);
              }}>
                <span>{item.shortName}</span>
                <em>{item.category}</em>
                <b className={item.changePercent >= 0 ? 'positive' : 'negative'}>{formatPercent(item.changePercent)}</b>
              </button>
            );
          })}
        </div>
      ) : <p className="empty-state">검색 조건에 맞는 ETF가 없습니다.</p>}
    </section>
  );
}

function RankingPanel({ filteredEtfs, onOpenEtf }) {
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

function SimpleListPanel({ title, items, emptyText, onOpenEtf }) {
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

function etfDeepLink(id) {
  return `?code=${encodeURIComponent(id)}`;
}

function handleEtfLinkClick(event, id, onOpenEtf) {
  if (
    event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) {
    return;
  }
  event.preventDefault();
  onOpenEtf(id);
}

function Radar({ factors }) {
  const entries = Object.entries(factors).filter(([, value]) => typeof value === 'number');
  const safeEntries = entries.filter(([label]) => label !== '총보수');
  const displayEntries = safeEntries.length ? safeEntries : [['단기 수익', 0], ['장기 수익', 0], ['가치', 0], ['안정성', 0], ['분산', 0], ['효율성', 0]];
  const centerX = 96;
  const centerY = 76;
  const radius = 44;
  const labelRadius = 67;
  const points = displayEntries.map(([, value], index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / displayEntries.length;
    const distance = (value / 100) * radius;
    return `${centerX + Math.cos(angle) * distance},${centerY + Math.sin(angle) * distance}`;
  }).join(' ');

  return (
    <svg className="radar" viewBox="0 0 192 152" aria-label="AIYN 팩터 레이더">
      {[0.25, 0.5, 0.75, 1].map((scale) => {
        const grid = displayEntries.map((_, index) => {
          const angle = -Math.PI / 2 + (index * 2 * Math.PI) / displayEntries.length;
          return `${centerX + Math.cos(angle) * radius * scale},${centerY + Math.sin(angle) * radius * scale}`;
        }).join(' ');
        return <polygon key={scale} points={grid} className="radar-grid" />;
      })}
      {displayEntries.map(([label], index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / displayEntries.length;
        return <text key={label} x={centerX + Math.cos(angle) * labelRadius} y={centerY + Math.sin(angle) * labelRadius + 4} textAnchor="middle">{label}</text>;
      })}
      <polygon points={points} className="radar-shape" />
    </svg>
  );
}

function DetailedSparkline({ values, currency }) {
  const stats = sparklineStats(values);
  if (!stats) {
    return (
      <div className="performance-visual empty-chart">
        <span className="sparkline-placeholder">성과 흐름 데이터 없음</span>
      </div>
    );
  }

  const points = stats.values.map((value, index) => {
    const x = 4 + (index / (stats.values.length - 1)) * 92;
    const y = 42 - ((value - stats.min) / stats.spread) * 34;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  return (
    <div className="detailed-chart-block">
      <div className="performance-visual detailed">
        <div className="chart-scale" aria-hidden="true">
          <span>{formatPrice(stats.max, currency)}</span>
          <span>{formatPrice(stats.mid, currency)}</span>
          <span>{formatPrice(stats.min, currency)}</span>
        </div>
        <svg className="detailed-sparkline" viewBox="0 0 100 48" aria-label="최근 가격 흐름">
          <line x1="4" y1="8" x2="96" y2="8" />
          <line x1="4" y1="25" x2="96" y2="25" />
          <line x1="4" y1="42" x2="96" y2="42" />
          <polyline points={points} />
          <circle cx="4" cy={42 - ((stats.start - stats.min) / stats.spread) * 34} r="1.8" />
          <circle cx="96" cy={42 - ((stats.end - stats.min) / stats.spread) * 34} r="1.8" />
        </svg>
      </div>
      <div className="chart-stat-grid">
        <MetricTile label="기간" value="최근 30일" />
        <MetricTile label="시작" value={formatPrice(stats.start, currency)} />
        <MetricTile label="최근" value={formatPrice(stats.end, currency)} tone={returnTone(stats.changePercent)} />
        <MetricTile label="구간 변화" value={formatPercent(stats.changePercent)} tone={returnTone(stats.changePercent)} />
      </div>
    </div>
  );
}

function Sparkline({ values }) {
  const cleanValues = (values ?? []).filter((value) => typeof value === 'number');
  if (cleanValues.length < 2) return <span className="sparkline-placeholder">-</span>;
  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  const spread = max - min || 1;
  const points = cleanValues.map((value, index) => {
    const x = (index / (cleanValues.length - 1)) * 86 + 2;
    const y = 34 - ((value - min) / spread) * 26;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="sparkline" viewBox="0 0 90 38" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function sparklineStats(values) {
  const cleanValues = (values ?? []).filter(isFiniteValue);
  if (cleanValues.length < 2) return null;
  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  const start = cleanValues[0];
  const end = cleanValues.at(-1);
  return {
    values: cleanValues,
    count: cleanValues.length,
    min,
    max,
    mid: (min + max) / 2,
    spread: max - min || 1,
    start,
    end,
    changePercent: start > 0 ? ((end / start) - 1) * 100 : null,
  };
}

function GuideModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 id="guide-title">사용 가이드</h2>
          <button className="icon-button small" type="button" onClick={onClose} aria-label="닫기"><X size={16} /></button>
        </div>
        <div className="guide-content">
          <p>통합검색은 ETF명, 티커, 운용사, 테마, 카테고리, 주요 보유종목명을 함께 검색합니다.</p>
          <p>검색 결과에서 ETF를 선택하면 메인 화면의 개별 분석이 해당 상품으로 전환됩니다.</p>
          <p>관심상품과 최근 조회는 브라우저 localStorage에 저장되어 새로고침 후에도 유지됩니다.</p>
          <p>내보내기는 현재 선택 ETF의 핵심 데이터를 CSV로 저장하고, 공유는 `code` 딥링크를 URL에 반영합니다.</p>
        </div>
      </section>
    </div>
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
            <span key={index} className={typeof value === 'number' && index < Math.round(value / 17) ? 'filled' : ''} />
          ))}
        </span>
      </div>
    );
  }
  if (type === 'plainPercent') return formatPlainPercent(value);
  if (type === 'return') return <span className={returnTone(value) ?? ''}>{formatPercent(value)}</span>;
  if (type === 'number') return formatNumber(value);
  if (type === 'aum') return formatAum(value, etf.currency);
  return value ?? '-';
}

function getPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object) ?? null;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildHoldingChart(holdings) {
  const totalWeight = holdings.reduce((sum, holding) => sum + (holding.weight ?? 0), 0);
  const otherWeight = Math.max(0, 100 - totalWeight);
  const state = holdings.reduce((acc, holding, index) => {
    const start = acc.total;
    const end = start + (holding.weight ?? 0);
    acc.stops.push(`${HOLDING_COLORS[index % HOLDING_COLORS.length]} ${start}% ${end}%`);
    acc.total = end;
    return acc;
  }, { stops: [], total: 0 });

  state.stops.push(`#c9d1d9 ${state.total}% ${state.total + otherWeight}%`);
  return { stops: state.stops, otherWeight };
}

function isFiniteValue(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function writeAnalysisUrl(id) {
  const params = new URLSearchParams();
  params.set('code', id);
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

function writeCompareUrl(selectedIds, activeId) {
  const params = new URLSearchParams();
  if (selectedIds.length) params.set('compare', selectedIds.join(','));
  if (activeId) params.set('active', activeId);
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

export default App;
