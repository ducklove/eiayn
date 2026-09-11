import {
  BookOpenCheck,
  Download,
  Filter,
  List,
  RefreshCw,
  Share2,
  ShieldCheck,
  Star,
  Trophy,
  WalletCards,
  X,
} from 'lucide-react';
import { FilterSelect } from '../common/FilterSelect.jsx';
import { DEFAULT_FILTERS } from '../../lib/search.js';

export function WorkspaceHeader({
  viewMode,
  selectedEtf,
  selectedIds,
  favorites,
  toggleFavorite,
  onShowCompare,
  onShowAnalysis,
  onShowList,
  onShowRanking,
  onClearFilters,
  filters,
  setFilters,
  filterOptions,
  query = '',
  onClearQuery,
  onResetFilters,
  resultCount,
  actionNote,
  setActionNote,
  onExport,
  onShare,
  onGuide,
}) {
  const isAnalysisView = viewMode === 'analysis';
  const isListView = viewMode === 'list';
  const isRankingView = viewMode === 'ranking';
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => value && value !== DEFAULT_FILTERS[key],
  );

  return (
    <div className="workspace-header" id="compare">
      <div className="title-block">
        <div>
          <h2>
            {isAnalysisView
              ? 'ETF 개별 분석'
              : isListView
                ? 'ETF 전체 목록'
                : isRankingView
                  ? 'AIYN 랭킹'
                  : 'ETF 비교'}
          </h2>
          <p>
            {isAnalysisView
              ? `${selectedEtf.name}의 비용, 성과, 위험, 보유종목을 한 화면에서 확인합니다.`
              : isListView
                ? '검색·필터 결과 전체를 총보수, 수익률, AIYN 점수 기준으로 정렬해 탐색합니다.'
                : isRankingView
                  ? '전체 유니버스를 AIYN 점수가 높은 순으로 정렬한 랭킹입니다.'
                  : '총보수, 순자산, 추적오차, 배당, 변동성을 실제 스냅샷 기준으로 비교합니다.'}
          </p>
        </div>
      </div>

      <div className="workspace-toolbar">
        <div className="view-switch" role="tablist" aria-label="화면 전환">
          <button
            className={viewMode === 'compare' ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={viewMode === 'compare'}
            onClick={onShowCompare}
          >
            <WalletCards size={16} />
            비교 화면
            <span>{selectedIds.length}/4</span>
          </button>
          <button
            className={viewMode === 'analysis' ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={viewMode === 'analysis'}
            onClick={onShowAnalysis}
          >
            <ShieldCheck size={16} />
            개별 분석
          </button>
          <button
            className={viewMode === 'list' ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={viewMode === 'list'}
            onClick={onShowList}
          >
            <List size={16} />
            전체 목록
          </button>
          <button
            className={viewMode === 'ranking' ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={viewMode === 'ranking'}
            onClick={onShowRanking}
          >
            <Trophy size={16} />
            AIYN 랭킹
          </button>
        </div>

        <div className="workspace-actions">
          <button className="guide-button" type="button" onClick={onGuide}>
            <BookOpenCheck size={16} />
            사용 가이드
          </button>
          <button
            className={`ghost-button ${favorites.includes(selectedEtf.id) ? 'selected-action' : ''}`}
            type="button"
            onClick={() => toggleFavorite(selectedEtf.id)}
          >
            <Star size={17} />
            관심상품
          </button>
          <button className="ghost-button" type="button" onClick={onExport}>
            <Download size={17} />
            {isAnalysisView
              ? '분석 내보내기'
              : isListView
                ? '검색 결과 내보내기'
                : isRankingView
                  ? '랭킹 내보내기'
                  : '비교 내보내기'}
          </button>
          <button className="ghost-button" type="button" onClick={onShare}>
            <Share2 size={17} />
            공유
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={isAnalysisView ? onShowCompare : onShowAnalysis}
          >
            {isAnalysisView ? '비교로 돌아가기' : '분석 보기'}
          </button>
        </div>
      </div>

      {isRankingView ? (
        <p className="filter-scope-note">
          AIYN 랭킹은 전체 ETF 기준입니다. 상단 검색창으로 상품을 찾거나 전체 목록에서 검색·필터를
          적용하세요.
        </p>
      ) : (
        <div className="filters" id="search">
          <span className="filter-main">
            <Filter size={17} />
            ETF 상품 검색 필터
          </span>
          <FilterSelect
            label="시장"
            value={filters.market}
            options={filterOptions.markets}
            onChange={(value) => setFilters((current) => ({ ...current, market: value }))}
          />
          <FilterSelect
            label="테마"
            value={filters.theme}
            options={filterOptions.themes}
            onChange={(value) => setFilters((current) => ({ ...current, theme: value }))}
          />
          <FilterSelect
            label="운용사"
            value={filters.provider}
            options={filterOptions.providers}
            onChange={(value) => setFilters((current) => ({ ...current, provider: value }))}
          />
          <FilterSelect
            label="리스크"
            value={filters.risk}
            options={filterOptions.risks}
            onChange={(value) => setFilters((current) => ({ ...current, risk: value }))}
          />
          <button className="ghost-button slim" type="button" onClick={onClearFilters}>
            <RefreshCw size={15} />
            초기화
          </button>
          <span className="result-count">{resultCount}개 검색됨</span>
        </div>
      )}
      {!isRankingView && (query.trim() || hasFilters) && (
        <div className="active-search-summary" role="status">
          {query.trim() && (
            <button type="button" onClick={onClearQuery} aria-label={`검색어 ${query} 해제`}>
              검색어: {query} <X size={14} />
            </button>
          )}
          {hasFilters && (
            <button type="button" onClick={onResetFilters}>
              필터만 해제 <X size={14} />
            </button>
          )}
          <span>
            {resultCount
              ? `현재 검색·필터에 맞는 ETF ${resultCount}개`
              : '조건에 맞는 ETF가 없습니다. 검색어를 줄이거나 필터를 해제해 보세요.'}
          </span>
          {!isListView && (
            <button type="button" onClick={onShowList}>
              검색·필터 결과 전체 보기
            </button>
          )}
        </div>
      )}

      {actionNote && (
        <div className="action-note" role="status">
          <ShieldCheck size={16} />
          {actionNote}
          <button type="button" onClick={() => setActionNote('')} aria-label="알림 닫기">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
