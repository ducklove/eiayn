import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentTitle } from './hooks/useDocumentTitle.js';
import { useEtfData } from './hooks/useEtfData.js';
import { usePersistentState } from './hooks/usePersistentState.js';
import { useTheme } from './hooks/useTheme.js';
import { buildCsv, downloadFile } from './lib/csv.js';
import { resolveInitialSelection } from './lib/deepLink.js';
import { formatDateTime } from './lib/format.js';
import { rankEtfsByScore } from './lib/ranking.js';
import { buildSearchIndex, filterEtfs, uniqueOptions } from './lib/search.js';
import { AnalysisPanel } from './components/analysis/AnalysisPanel.jsx';
import { EtfAnalysisDashboard } from './components/analysis/EtfAnalysisDashboard.jsx';
import { ComparisonGrid } from './components/compare/ComparisonGrid.jsx';
import { CostCalculator } from './components/compare/CostCalculator.jsx';
import { PerformanceOverlay } from './components/compare/PerformanceOverlay.jsx';
import { PortfolioSimulator } from './components/compare/PortfolioSimulator.jsx';
import { UniverseStrip } from './components/compare/UniverseStrip.jsx';
import { WorkspaceHeader } from './components/compare/WorkspaceHeader.jsx';
import { EtfTable } from './components/list/EtfTable.jsx';
import { AiynRankingView } from './components/ranking/AiynRankingView.jsx';
import { PresetBar } from './components/common/PresetBar.jsx';
import { RankingPanel } from './components/common/RankingPanel.jsx';
import { SimpleListPanel } from './components/common/SimpleListPanel.jsx';
import { ChangesPanel } from './components/common/ChangesPanel.jsx';
import { GuideModal } from './components/layout/GuideModal.jsx';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { StatusScreen } from './components/layout/StatusScreen.jsx';
import { TopBar } from './components/layout/TopBar.jsx';

const DEFAULT_FILTERS = {
  market: '시장 전체',
  theme: '테마 전체',
  provider: '운용사 전체',
  risk: '리스크 전체',
};

function App() {
  const { data, loading, error, reload } = useEtfData();
  const [theme, toggleTheme] = useTheme();
  const etfs = useMemo(() => data?.etfs ?? [], [data]);
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
  const searchRef = useRef(null);
  const deferredQuery = useDeferredValue(query);

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

  // Browser back/forward restores the view encoded in the URL by openAnalysis/showCompare.
  useEffect(() => {
    if (!etfs.length) return undefined;
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const selection = resolveInitialSelection(etfs, params);
      if (params.get('code') || params.get('compare') || params.get('active')) {
        setSelectedIds(selection.selectedIds);
        setActiveId(selection.activeId);
        setViewMode(selection.viewMode);
      } else if (selection.viewMode === 'list' || selection.viewMode === 'ranking') {
        setViewMode(selection.viewMode);
      } else {
        // Bare URL (the entry point): return to compare but keep the current basket.
        setViewMode('compare');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [etfs]);

  // Focus search with "/" unless the user is already typing in a field.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
        return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const searchIndex = useMemo(() => buildSearchIndex(etfs), [etfs]);
  const filteredEtfs = useMemo(
    () => filterEtfs(etfs, deferredQuery, filters, searchIndex),
    [etfs, deferredQuery, filters, searchIndex],
  );
  const searchResults = useMemo(() => filteredEtfs.slice(0, 8), [filteredEtfs]);
  const selectedEtfs = useMemo(
    () => selectedIds.map((id) => etfs.find((etf) => etf.id === id)).filter(Boolean),
    [selectedIds, etfs],
  );
  const selectedEtf = etfs.find((etf) => etf.id === activeId) ?? selectedEtfs[0] ?? etfs[0];
  const favoriteEtfs = etfs.filter((etf) => favorites.includes(etf.id));
  const recentEtfs = recentIds.map((id) => etfs.find((etf) => etf.id === id)).filter(Boolean);
  const isAnalysisView = viewMode === 'analysis';
  const isListView = viewMode === 'list';
  const isRankingView = viewMode === 'ranking';
  const isCompareView = !isAnalysisView && !isListView && !isRankingView;

  useDocumentTitle(viewMode, selectedEtf);

  const filterOptions = useMemo(
    () => ({
      markets: uniqueOptions(etfs, 'market', '시장 전체'),
      themes: uniqueOptions(etfs, 'theme', '테마 전체'),
      providers: uniqueOptions(etfs, 'provider', '운용사 전체'),
      risks: ['리스크 전체', '낮음', '보통', '높음', '데이터 없음'],
    }),
    [etfs],
  );

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
  };

  const openAnalysis = (id) => {
    const next = etfs.find((etf) => etf.id === id);
    if (!next) return;
    setActiveId(id);
    setViewMode('analysis');
    writeAnalysisUrl(id);
  };

  const showCompare = () => {
    setViewMode('compare');
    writeCompareUrl(selectedIds, activeId);
  };

  const showActiveAnalysis = () => {
    openAnalysis(selectedEtf.id);
  };

  const showList = () => {
    setViewMode('list');
    writeListUrl();
  };

  const showRanking = () => {
    setViewMode('ranking');
    writeRankingUrl();
  };

  const addCompareFromList = (id) => {
    if (!etfs.some((etf) => etf.id === id) || selectedIds.includes(id)) return;
    setSelectedIds((current) => [...current, id].slice(-4));
  };

  const applyPreset = (preset) => {
    setQuery('');
    setFilters({ ...DEFAULT_FILTERS, ...preset.filters });
    setViewMode('list');
    writeListUrl();
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
    setFavorites((current) =>
      current.includes(id) ? current.filter((favoriteId) => favoriteId !== id) : [...current, id],
    );
  };

  const clearFilters = () => {
    setQuery('');
    setFilters(DEFAULT_FILTERS);
  };

  const exportCsv = () => {
    const exportEtfs = isRankingView
      ? rankEtfsByScore(etfs)
      : isListView
        ? filteredEtfs
        : isAnalysisView
          ? [selectedEtf]
          : selectedEtfs;
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
    const csv = buildCsv(rows);
    if (!csv) return;
    const prefix = isRankingView
      ? 'ranking'
      : isListView
        ? 'list'
        : isAnalysisView
          ? selectedEtf.id
          : 'compare';
    downloadFile(
      `eiayn-${prefix}-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8',
    );
    setActionNote(
      isRankingView
        ? `AIYN 랭킹 ${rows.length}개 ETF를 CSV로 내보냈습니다.`
        : isListView
          ? `검색 결과 ${rows.length}개 ETF를 CSV로 내보냈습니다.`
          : isAnalysisView
            ? `${selectedEtf.shortName} 분석 데이터를 CSV로 내보냈습니다.`
            : '현재 비교 바구니를 CSV로 내보냈습니다.',
    );
  };

  const shareState = async () => {
    const params = new URLSearchParams();
    if (isAnalysisView && selectedEtf?.id) {
      params.set('code', selectedEtf.id);
    } else if (isListView) {
      params.set('view', 'list');
    } else if (isRankingView) {
      params.set('view', 'ranking');
    } else {
      if (selectedIds.length) params.set('compare', selectedIds.join(','));
      if (activeId) params.set('active', activeId);
    }
    if (query) params.set('q', query);
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== DEFAULT_FILTERS[key]) params.set(key, value);
    }
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'ETF is All You Need', url });
        setActionNote('공유 링크를 만들었습니다.');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setActionNote('공유 링크를 복사했습니다.');
      } else {
        window.history.replaceState(null, '', url);
        setActionNote('공유 링크를 주소창에 반영했습니다.');
      }
    } catch {
      window.history.replaceState(null, '', url);
      setActionNote(
        '공유 링크를 주소창에 반영했습니다. 복사 권한은 브라우저에서 허용되지 않았습니다.',
      );
    }
  };

  if (loading || !initialized) {
    return (
      <StatusScreen
        title="ETF 데이터를 불러오는 중입니다"
        message="빌드 시 생성된 최신 스냅샷을 확인하고 있습니다."
      />
    );
  }

  if (error) {
    return (
      <StatusScreen
        title="데이터를 불러오지 못했습니다"
        message={error.message}
        action={
          <button className="primary-button" type="button" onClick={reload}>
            다시 시도
          </button>
        }
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
        <TopBar
          query={query}
          onQueryChange={setQuery}
          exchangeRate={data.exchangeRates?.usdKrw}
          searchRef={searchRef}
          theme={theme}
          onToggleTheme={toggleTheme}
          searchResults={searchResults}
          searchResultCount={filteredEtfs.length}
          onOpenSearchResult={openAnalysis}
        />
        <main className={`content-grid ${isCompareView ? '' : 'single-analysis'}`}>
          <div className={`workspace ${isAnalysisView ? 'analysis-workspace' : ''}`}>
            <WorkspaceHeader
              viewMode={viewMode}
              selectedEtf={selectedEtf}
              selectedIds={selectedIds}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              onShowCompare={showCompare}
              onShowAnalysis={showActiveAnalysis}
              onShowList={showList}
              onShowRanking={showRanking}
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
            <PresetBar onApply={applyPreset} />
            {isCompareView && (
              <UniverseStrip
                filteredEtfs={filteredEtfs}
                activeEtf={selectedEtf}
                activeId={selectedEtf.id}
                onSelect={openAnalysis}
              />
            )}
            {isAnalysisView ? (
              <EtfAnalysisDashboard
                selectedEtf={selectedEtf}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
              />
            ) : isListView ? (
              <EtfTable
                etfs={filteredEtfs}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                onOpenEtf={openAnalysis}
                onAddCompare={addCompareFromList}
                selectedIds={selectedIds}
              />
            ) : isRankingView ? (
              <AiynRankingView etfs={etfs} onOpenEtf={openAnalysis} />
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
            {isCompareView && (
              <div className="compare-tools">
                <PerformanceOverlay selectedEtfs={selectedEtfs} />
                <CostCalculator selectedEtfs={selectedEtfs} />
                <PortfolioSimulator selectedEtfs={selectedEtfs} />
              </div>
            )}
            {isAnalysisView && (
              <UniverseStrip
                filteredEtfs={filteredEtfs}
                activeEtf={selectedEtf}
                activeId={selectedEtf.id}
                onSelect={openAnalysis}
              />
            )}
            {!isListView && !isRankingView && <ChangesPanel onOpenEtf={openAnalysis} />}
            {!isListView && !isRankingView && (
              <div className="bottom-grid">
                <RankingPanel
                  filteredEtfs={filteredEtfs.length ? filteredEtfs : etfs}
                  onOpenEtf={openAnalysis}
                />
                <SimpleListPanel
                  title="최근 조회"
                  items={recentEtfs}
                  emptyText="아직 조회한 ETF가 없습니다."
                  onOpenEtf={openAnalysis}
                />
                <SimpleListPanel
                  title="관심상품"
                  items={favoriteEtfs}
                  emptyText="별 버튼으로 관심상품을 추가하세요."
                  onOpenEtf={openAnalysis}
                />
              </div>
            )}
          </div>
          {isCompareView && (
            <AnalysisPanel
              selectedEtf={selectedEtf}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
            />
          )}
        </main>
        <footer className="site-footer">
          <span>마지막 업데이트: {formatDateTime(data.generatedAt)} KST</span>
          <span>데이터 출처: 네이버 금융, Yahoo Finance, StockAnalysis</span>
          <a href="#risk">투자 유의 고지</a>
        </footer>
      </div>
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}

function pushUrl(url) {
  const current = `${window.location.pathname}${window.location.search}`;
  if (url === current) return;
  window.history.pushState(null, '', url);
}

function writeAnalysisUrl(id) {
  const params = new URLSearchParams();
  params.set('code', id);
  pushUrl(`${window.location.pathname}?${params.toString()}`);
}

function writeCompareUrl(selectedIds, activeId) {
  const params = new URLSearchParams();
  if (selectedIds.length) params.set('compare', selectedIds.join(','));
  if (activeId) params.set('active', activeId);
  const query = params.toString();
  pushUrl(`${window.location.pathname}${query ? `?${query}` : ''}`);
}

function writeListUrl() {
  pushUrl(`${window.location.pathname}?view=list`);
}

function writeRankingUrl() {
  pushUrl(`${window.location.pathname}?view=ranking`);
}

export default App;
