import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  Download,
  Filter,
  Gauge,
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

const etfs = [
  {
    id: '360750',
    name: 'TIGER 미국S&P500',
    short: 'TIGER S&P500',
    provider: '미래에셋',
    market: '국내',
    asset: '주식',
    theme: '대표지수',
    category: '미국 대형주',
    index: 'S&P 500 TR',
    price: '18,765',
    change: 0.32,
    score: 82,
    status: '우수',
    expense: 0.07,
    aum: '₩6.82조',
    tracking: 0.18,
    dividend: 1.38,
    volatility: 13.21,
    sharpe: 0.92,
    drawdown: -19.62,
    informationRatio: 0.68,
    listed: '2020.08.07',
    returns: { m3: 3.42, y1: 23.18, y3: 14.21, y5: 15.02 },
    factors: { 수익성: 85, 가치: 65, 안정성: 75, 분산: 90, 효율성: 90 },
    holdings: [
      ['애플', 6.68, '#0f3761'],
      ['마이크로소프트', 6.15, '#e06f42'],
      ['엔비디아', 5.73, '#2fbf71'],
      ['아마존', 3.64, '#7b8794'],
      ['메타 플랫폼스', 2.58, '#f2b84b'],
    ],
    spark: [28, 31, 30, 36, 34, 40, 38, 46, 44, 51],
  },
  {
    id: 'QQQ',
    name: 'QQQ',
    short: 'QQQ',
    provider: 'Invesco',
    market: '미국',
    asset: '주식',
    theme: '테크',
    category: 'NASDAQ-100',
    index: 'NASDAQ-100 Index',
    price: '495.22',
    change: 0.28,
    score: 78,
    status: '양호',
    expense: 0.2,
    aum: '$314.01B',
    tracking: 0.28,
    dividend: 0.73,
    volatility: 19.47,
    sharpe: 0.78,
    drawdown: -27.44,
    informationRatio: 0.52,
    listed: '1999.03.10',
    returns: { m3: 2.18, y1: 20.91, y3: 12.38, y5: 17.25 },
    factors: { 수익성: 90, 가치: 52, 안정성: 61, 분산: 76, 효율성: 88 },
    holdings: [
      ['마이크로소프트', 8.41, '#0f3761'],
      ['애플', 7.66, '#e06f42'],
      ['엔비디아', 7.31, '#2fbf71'],
      ['브로드컴', 4.62, '#7b8794'],
      ['아마존', 4.21, '#f2b84b'],
    ],
    spark: [25, 30, 29, 33, 38, 36, 43, 41, 47, 49],
  },
  {
    id: 'VTI',
    name: 'VTI',
    short: 'VTI',
    provider: 'Vanguard',
    market: '미국',
    asset: '주식',
    theme: '대표지수',
    category: '미국 전체시장',
    index: 'CRSP US Total Market',
    price: '279.11',
    change: 0.12,
    score: 74,
    status: '양호',
    expense: 0.03,
    aum: '$1.59T',
    tracking: 0.32,
    dividend: 1.55,
    volatility: 14.62,
    sharpe: 0.81,
    drawdown: -20.84,
    informationRatio: 0.61,
    listed: '2001.05.24',
    returns: { m3: 2.87, y1: 19.12, y3: 11.08, y5: 14.01 },
    factors: { 수익성: 76, 가치: 72, 안정성: 79, 분산: 95, 효율성: 86 },
    holdings: [
      ['애플', 5.44, '#0f3761'],
      ['마이크로소프트', 5.2, '#e06f42'],
      ['엔비디아', 4.68, '#2fbf71'],
      ['아마존', 2.98, '#7b8794'],
      ['알파벳', 2.84, '#f2b84b'],
    ],
    spark: [27, 29, 31, 35, 34, 36, 38, 40, 39, 44],
  },
  {
    id: '069500',
    name: 'KODEX 200',
    short: 'KODEX 200',
    provider: '삼성자산운용',
    market: '국내',
    asset: '주식',
    theme: '대표지수',
    category: 'KOSPI 200',
    index: 'KOSPI 200',
    price: '33,815',
    change: 0.41,
    score: 69,
    status: '보통',
    expense: 0.15,
    aum: '₩5.71조',
    tracking: 0.22,
    dividend: 1.72,
    volatility: 16.32,
    sharpe: 0.64,
    drawdown: -24.2,
    informationRatio: 0.42,
    listed: '2002.10.14',
    returns: { m3: 1.91, y1: 14.22, y3: 6.21, y5: 9.74 },
    factors: { 수익성: 67, 가치: 74, 안정성: 64, 분산: 88, 효율성: 70 },
    holdings: [
      ['삼성전자', 22.11, '#0f3761'],
      ['SK하이닉스', 7.42, '#e06f42'],
      ['현대차', 2.71, '#2fbf71'],
      ['셀트리온', 2.34, '#7b8794'],
      ['기아', 2.02, '#f2b84b'],
    ],
    spark: [22, 26, 25, 28, 31, 29, 35, 36, 39, 41],
  },
  {
    id: '379800',
    name: 'KODEX 미국S&P500TR',
    short: 'KODEX S&P500TR',
    provider: '삼성자산운용',
    market: '국내',
    asset: '주식',
    theme: '대표지수',
    category: '미국 대형주',
    index: 'S&P 500 TR',
    price: '21,940',
    change: 0.29,
    score: 80,
    status: '우수',
    expense: 0.05,
    aum: '₩3.11조',
    tracking: 0.2,
    dividend: 0,
    volatility: 13.48,
    sharpe: 0.89,
    drawdown: -19.8,
    informationRatio: 0.65,
    listed: '2021.04.09',
    returns: { m3: 3.35, y1: 22.42, y3: 13.92, y5: 0 },
    factors: { 수익성: 84, 가치: 64, 안정성: 77, 분산: 90, 효율성: 92 },
    holdings: [
      ['애플', 6.68, '#0f3761'],
      ['마이크로소프트', 6.15, '#e06f42'],
      ['엔비디아', 5.73, '#2fbf71'],
      ['아마존', 3.64, '#7b8794'],
      ['메타 플랫폼스', 2.58, '#f2b84b'],
    ],
    spark: [26, 29, 30, 35, 33, 39, 41, 44, 43, 50],
  },
  {
    id: '458730',
    name: 'TIGER 미국배당다우존스',
    short: 'TIGER 배당다우',
    provider: '미래에셋',
    market: '국내',
    asset: '주식',
    theme: '배당',
    category: '미국 배당성장',
    index: 'Dow Jones US Dividend 100',
    price: '12,845',
    change: 0.18,
    score: 76,
    status: '양호',
    expense: 0.01,
    aum: '₩1.26조',
    tracking: 0.25,
    dividend: 3.42,
    volatility: 11.84,
    sharpe: 0.74,
    drawdown: -15.32,
    informationRatio: 0.54,
    listed: '2023.06.20',
    returns: { m3: 1.44, y1: 13.68, y3: 0, y5: 0 },
    factors: { 수익성: 72, 가치: 78, 안정성: 82, 분산: 79, 효율성: 88 },
    holdings: [
      ['록히드마틴', 4.14, '#0f3761'],
      ['홈디포', 4.02, '#e06f42'],
      ['버라이즌', 3.78, '#2fbf71'],
      ['텍사스 인스트루먼트', 3.65, '#7b8794'],
      ['펩시코', 3.44, '#f2b84b'],
    ],
    spark: [20, 22, 24, 23, 26, 29, 31, 30, 33, 35],
  },
  {
    id: '091160',
    name: 'KODEX 반도체',
    short: 'KODEX 반도체',
    provider: '삼성자산운용',
    market: '국내',
    asset: '주식',
    theme: '반도체',
    category: '국내 반도체',
    index: 'KRX Semicon Index',
    price: '46,520',
    change: -0.18,
    score: 71,
    status: '보통',
    expense: 0.45,
    aum: '₩7,940억',
    tracking: 0.41,
    dividend: 0.44,
    volatility: 24.91,
    sharpe: 0.7,
    drawdown: -33.4,
    informationRatio: 0.48,
    listed: '2006.06.27',
    returns: { m3: 7.12, y1: 28.44, y3: 16.83, y5: 18.21 },
    factors: { 수익성: 88, 가치: 54, 안정성: 49, 분산: 61, 효율성: 66 },
    holdings: [
      ['SK하이닉스', 23.82, '#0f3761'],
      ['삼성전자', 20.19, '#e06f42'],
      ['한미반도체', 6.15, '#2fbf71'],
      ['리노공업', 4.61, '#7b8794'],
      ['원익IPS', 3.42, '#f2b84b'],
    ],
    spark: [29, 33, 31, 38, 45, 42, 48, 52, 50, 58],
  },
  {
    id: 'SOXX',
    name: 'SOXX',
    short: 'SOXX',
    provider: 'iShares',
    market: '미국',
    asset: '주식',
    theme: '반도체',
    category: '글로벌 반도체',
    index: 'NYSE Semiconductor',
    price: '224.42',
    change: 0.62,
    score: 77,
    status: '양호',
    expense: 0.35,
    aum: '$15.25B',
    tracking: 0.27,
    dividend: 0.61,
    volatility: 24.12,
    sharpe: 0.88,
    drawdown: -35.74,
    informationRatio: 0.55,
    listed: '2001.07.10',
    returns: { m3: 8.21, y1: 40.28, y3: 17.92, y5: 24.1 },
    factors: { 수익성: 92, 가치: 51, 안정성: 48, 분산: 65, 효율성: 76 },
    holdings: [
      ['브로드컴', 9.16, '#0f3761'],
      ['엔비디아', 8.88, '#e06f42'],
      ['AMD', 6.44, '#2fbf71'],
      ['퀄컴', 5.72, '#7b8794'],
      ['텍사스 인스트루먼트', 5.01, '#f2b84b'],
    ],
    spark: [28, 35, 32, 41, 47, 46, 53, 58, 57, 64],
  },
  {
    id: 'SCHD',
    name: 'SCHD',
    short: 'SCHD',
    provider: 'Schwab',
    market: '미국',
    asset: '주식',
    theme: '배당',
    category: '미국 배당성장',
    index: 'Dow Jones US Dividend 100',
    price: '81.34',
    change: 0.22,
    score: 75,
    status: '양호',
    expense: 0.06,
    aum: '$61.71B',
    tracking: 0.21,
    dividend: 3.48,
    volatility: 12.05,
    sharpe: 0.71,
    drawdown: -16.44,
    informationRatio: 0.5,
    listed: '2011.10.20',
    returns: { m3: 1.32, y1: 14.08, y3: 8.62, y5: 12.31 },
    factors: { 수익성: 69, 가치: 82, 안정성: 84, 분산: 78, 효율성: 79 },
    holdings: [
      ['브리스톨마이어스', 4.18, '#0f3761'],
      ['홈디포', 4.02, '#e06f42'],
      ['암젠', 3.95, '#2fbf71'],
      ['버라이즌', 3.91, '#7b8794'],
      ['셰브론', 3.62, '#f2b84b'],
    ],
    spark: [20, 23, 25, 24, 27, 26, 29, 30, 32, 33],
  },
  {
    id: 'ARKK',
    name: 'ARKK',
    short: 'ARKK',
    provider: 'ARK Invest',
    market: '미국',
    asset: '주식',
    theme: '혁신성장',
    category: '테마 성장주',
    index: 'Active',
    price: '61.90',
    change: -0.44,
    score: 58,
    status: '주의',
    expense: 0.75,
    aum: '$7.44B',
    tracking: 0,
    dividend: 0,
    volatility: 33.18,
    sharpe: 0.31,
    drawdown: -71.2,
    informationRatio: 0.2,
    listed: '2014.10.31',
    returns: { m3: 6.15, y1: 10.35, y3: -9.74, y5: 7.12 },
    factors: { 수익성: 54, 가치: 40, 안정성: 35, 분산: 58, 효율성: 42 },
    holdings: [
      ['테슬라', 10.22, '#0f3761'],
      ['로쿠', 8.41, '#e06f42'],
      ['코인베이스', 7.8, '#2fbf71'],
      ['로블록스', 6.55, '#7b8794'],
      ['블록', 5.88, '#f2b84b'],
    ],
    spark: [36, 30, 42, 39, 45, 41, 51, 48, 44, 53],
  },
];

const metricRows = [
  ['AIYN 점수', 'score', 'score'],
  ['총보수 (연)', 'expense', 'percent'],
  ['순자산 (AUM)', 'aum', 'text'],
  ['추적오차 (3년)', 'tracking', 'percent'],
  ['배당수익률 (연)', 'dividend', 'percent'],
  ['변동성 (3년 연환산)', 'volatility', 'percent'],
  ['샤프지수 (3년)', 'sharpe', 'number'],
  ['3개월 수익률', 'm3', 'return'],
  ['1년 수익률', 'y1', 'return'],
  ['3년 수익률 (연환산)', 'y3', 'return'],
  ['5년 수익률 (연환산)', 'y5', 'return'],
  ['상장일', 'listed', 'text'],
  ['기초지수', 'index', 'text'],
];

const marketOptions = ['시장 전체', '국내', '미국'];
const themeOptions = ['테마 전체', '대표지수', '테크', '배당', '반도체', '혁신성장'];
const providerOptions = ['운용사 전체', '미래에셋', '삼성자산운용', 'Vanguard', 'Invesco', 'iShares', 'Schwab', 'ARK Invest'];
const riskOptions = ['리스크 전체', '낮음', '보통', '높음'];

function getRiskBand(etf) {
  if (etf.volatility < 13) return '낮음';
  if (etf.volatility < 22) return '보통';
  return '높음';
}

function formatMetric(etf, key, type) {
  const value = key in etf ? etf[key] : etf.returns[key];

  if (type === 'score') {
    return (
      <div className="score-metric">
        <strong>{value}</strong>
        <span className="score-bars" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className={index < Math.round(value / 17) ? 'filled' : ''} />
          ))}
        </span>
      </div>
    );
  }

  if (type === 'percent') {
    return `${value.toFixed(value < 1 ? 2 : 2)}%`;
  }

  if (type === 'return') {
    if (!value) return '-';
    return <span className={value >= 0 ? 'positive' : 'negative'}>{value > 0 ? '+' : ''}{value.toFixed(2)}%</span>;
  }

  if (type === 'number') {
    return value.toFixed(2);
  }

  return value;
}

function Sparkline({ values }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 86 + 2;
      const y = 34 - ((value - min) / spread) * 26;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="sparkline" viewBox="0 0 90 38" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function Sidebar({ selectedIds, favorites }) {
  const watchlist = etfs.filter((etf) => favorites.includes(etf.id)).slice(0, 6);

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
        <a className="active" href="#dashboard"><LayoutDashboard size={18} />대시보드</a>
        <a href="#compare"><WalletCards size={18} />ETF 비교</a>
        <a href="#model"><ShieldCheck size={18} />평가 모델</a>
        <a href="#ranking"><TrendingUp size={18} />수익률 랭킹</a>
        <a href="#search"><Search size={18} />ETF 검색</a>
        <a href="#holdings"><SlidersHorizontal size={18} />구성종목 검색</a>
        <a href="#favorites"><Star size={18} />관심상품</a>
        <a href="#basket"><BriefcaseBusiness size={18} />비교 바구니 <strong>{selectedIds.length}</strong></a>
        <a href="#settings"><Settings size={18} />알림 설정</a>
      </nav>

      <section className="watchlist" aria-labelledby="watchlist-title">
        <div className="section-heading">
          <h2 id="watchlist-title">관심상품 ({favorites.length})</h2>
          <button type="button">편집</button>
        </div>
        <div className="watchlist-items">
          {watchlist.map((item) => (
            <div className="watch-row" key={item.id}>
              <span className="dot" />
              <div>
                <strong>{item.short}</strong>
                <small>{item.id}</small>
              </div>
              <p>
                {item.price}
                <span className={item.change >= 0 ? 'positive' : 'negative'}>{item.change > 0 ? '+' : ''}{item.change}%</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="recent-mini" aria-labelledby="recent-title">
        <div className="section-heading">
          <h2 id="recent-title">최근 조회</h2>
          <button type="button">더보기</button>
        </div>
        {['SOXX', 'XLK', 'ARKK'].map((symbol) => {
          const item = etfs.find((etf) => etf.short === symbol || etf.id === symbol);
          return (
            <div className="recent-row" key={symbol}>
              <strong>{symbol}</strong>
              <span>{item?.provider}</span>
            </div>
          );
        })}
      </section>

      <div className="data-note">
        <span>데이터 제공: 예시 데이터</span>
        <span>마지막 업데이트: 2026.06.04 07:30</span>
      </div>
    </aside>
  );
}

function TopBar({ query, onQueryChange }) {
  return (
    <header className="topbar">
      <button className="icon-button" aria-label="메뉴 열기" type="button">
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
      <div className="market-status" aria-label="시장 상태">
        <span>USD/KRW</span>
        <strong>1,372.50</strong>
        <em>-0.32%</em>
      </div>
      <div className="top-actions">
        <button className="icon-button" aria-label="다크 모드" type="button"><Moon size={18} /></button>
        <button className="icon-button" aria-label="알림" type="button"><Bell size={18} /></button>
        <button className="icon-button" aria-label="도움말" type="button"><CircleHelp size={18} /></button>
      </div>
    </header>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <ChevronDown size={16} />
    </label>
  );
}

function ComparisonHeader({
  selectedIds,
  onAddNext,
  onClearFilters,
  filters,
  setFilters,
  resultCount,
  actionNote,
  setActionNote,
}) {
  return (
    <div className="workspace-header" id="compare">
      <div className="title-block">
        <div>
          <h2>ETF 비교</h2>
          <p>총보수, 순자산, 추적오차, 배당, 변동성을 한 화면에서 비교합니다.</p>
        </div>
        <button className="guide-button" type="button">
          <BookOpenCheck size={16} />
          사용 가이드
        </button>
      </div>

      <div className="workspace-actions">
        <button className="ghost-button" type="button">
          <BriefcaseBusiness size={17} />
          비교 바구니
          <span>{selectedIds.length}/4</span>
        </button>
        <button className="ghost-button" type="button">
          <Download size={17} />
          내보내기
        </button>
        <button className="ghost-button" type="button">
          <Share2 size={17} />
          공유
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => setActionNote('선택한 ETF의 비교 리포트를 생성했습니다.')}
        >
          비교하기
        </button>
      </div>

      <div className="filters" id="search">
        <button className="filter-main" type="button">
          <Filter size={17} />
          ETF 상품 검색 필터
        </button>
        <FilterSelect
          label="시장"
          value={filters.market}
          options={marketOptions}
          onChange={(value) => setFilters((current) => ({ ...current, market: value }))}
        />
        <FilterSelect
          label="테마"
          value={filters.theme}
          options={themeOptions}
          onChange={(value) => setFilters((current) => ({ ...current, theme: value }))}
        />
        <FilterSelect
          label="운용사"
          value={filters.provider}
          options={providerOptions}
          onChange={(value) => setFilters((current) => ({ ...current, provider: value }))}
        />
        <FilterSelect
          label="리스크"
          value={filters.risk}
          options={riskOptions}
          onChange={(value) => setFilters((current) => ({ ...current, risk: value }))}
        />
        <button className="ghost-button slim" type="button" onClick={onClearFilters}>
          <RefreshCw size={15} />
          초기화
        </button>
        <button className="ghost-button slim" type="button" onClick={onAddNext}>
          <Plus size={15} />
          ETF 추가
        </button>
        <span className="result-count">{resultCount}개 검색됨</span>
      </div>

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

function ComparisonGrid({ selectedEtfs, activeId, onSelect, onRemove, favorites, toggleFavorite }) {
  return (
    <section className="comparison-grid" aria-labelledby="comparison-title">
      <div className="compare-labels">
        <div className="compare-cell header-cell">
          <h3 id="comparison-title">비교 중인 ETF ({selectedEtfs.length})</h3>
          <p>선택한 상품을 드래그하듯 순서화한 비교표입니다.</p>
        </div>
        {metricRows.map(([label]) => (
          <div className="compare-cell metric-label" key={label}>{label}</div>
        ))}
        <div className="compare-cell metric-label">관심상품</div>
      </div>

      <div className="compare-columns">
        {selectedEtfs.map((etf) => (
          <article
            className={`compare-column ${activeId === etf.id ? 'active' : ''}`}
            key={etf.id}
            onClick={() => onSelect(etf.id)}
          >
            <div className="compare-cell etf-head">
              <label className="checkbox-line" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={activeId === etf.id}
                  onChange={() => onSelect(etf.id)}
                />
                <span>{etf.name}</span>
              </label>
              <button
                className="icon-button small"
                aria-label={`${etf.name} 비교 제거`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(etf.id);
                }}
              >
                <X size={16} />
              </button>
              <p>{etf.id} · {etf.market} · {etf.category}</p>
            </div>
            {metricRows.map(([label, key, type]) => (
              <div className="compare-cell metric-value" key={`${etf.id}-${label}`}>
                <span>{formatMetric(etf, key, type)}</span>
                {type === 'return' && etf.returns[key] ? <Sparkline values={etf.spark} /> : null}
              </div>
            ))}
            <div className="compare-cell favorite-cell">
              <button
                className={`favorite-button ${favorites.includes(etf.id) ? 'selected' : ''}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(etf.id);
                }}
              >
                <Star size={16} />
                관심 추가
              </button>
            </div>
          </article>
        ))}
        {selectedEtfs.length < 4 && (
          <button className="add-slot" type="button" onClick={() => onSelect('add-next')}>
            <Plus size={20} />
            ETF 추가
          </button>
        )}
      </div>
    </section>
  );
}

function Radar({ factors }) {
  const entries = Object.entries(factors);
  const center = 70;
  const radius = 52;
  const points = entries
    .map(([, value], index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / entries.length;
      const distance = (value / 100) * radius;
      return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`;
    })
    .join(' ');

  return (
    <svg className="radar" viewBox="0 0 140 140" aria-label="AIYN 팩터 레이더">
      {[0.25, 0.5, 0.75, 1].map((scale) => {
        const grid = entries
          .map((_, index) => {
            const angle = -Math.PI / 2 + (index * 2 * Math.PI) / entries.length;
            return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
          })
          .join(' ');
        return <polygon key={scale} points={grid} className="radar-grid" />;
      })}
      {entries.map(([label], index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / entries.length;
        return (
          <text
            key={label}
            x={center + Math.cos(angle) * 64}
            y={center + Math.sin(angle) * 64 + 4}
            textAnchor="middle"
          >
            {label}
          </text>
        );
      })}
      <polygon points={points} className="radar-shape" />
    </svg>
  );
}

function AnalysisPanel({ selectedEtf, favorites, toggleFavorite }) {
  const otherHoldings = 100 - selectedEtf.holdings.reduce((sum, [, weight]) => sum + weight, 0);
  const donutStops = selectedEtf.holdings.reduce(
    (acc, [, weight, color]) => {
      const start = acc.total;
      const end = start + weight;
      acc.parts.push(`${color} ${start}% ${end}%`);
      acc.total = end;
      return acc;
    },
    { parts: [], total: 0 },
  );
  donutStops.parts.push(`#c9d1d9 ${donutStops.total}% ${donutStops.total + otherHoldings}%`);

  const riskTone = selectedEtf.volatility > 22 ? '높음' : selectedEtf.volatility > 13 ? '보통' : '낮음';

  return (
    <aside className="analysis-panel" id="model">
      <div className="panel-title">
        <span>선택된 ETF 분석</span>
        <button className="icon-button small" type="button" aria-label="패널 접기">
          <ChevronDown size={16} />
        </button>
      </div>

      <section className="selected-summary">
        <div className="summary-title">
          <div>
            <h2>{selectedEtf.name}</h2>
            <p>{selectedEtf.id} · {selectedEtf.market} · {selectedEtf.asset} · {selectedEtf.category}</p>
          </div>
          <button
            className={`star-icon ${favorites.includes(selectedEtf.id) ? 'selected' : ''}`}
            type="button"
            onClick={() => toggleFavorite(selectedEtf.id)}
            aria-label="관심상품 토글"
          >
            <Star size={20} />
          </button>
        </div>
        <div className="quote-line">
          <div>
            <span>현재가</span>
            <strong>{selectedEtf.price}</strong>
          </div>
          <em className={selectedEtf.change >= 0 ? 'positive' : 'negative'}>
            {selectedEtf.change > 0 ? '+' : ''}{selectedEtf.change}% ({selectedEtf.change > 0 ? '▲' : '▼'})
          </em>
        </div>
      </section>

      <section className="score-card">
        <div className="score-main">
          <span>AIYN 점수</span>
          <strong>{selectedEtf.score}<small>/100</small></strong>
          <b>{selectedEtf.status}</b>
        </div>
        <Radar factors={selectedEtf.factors} />
      </section>

      <section className="portfolio-block" id="holdings">
        <div className="section-heading">
          <h3>포트폴리오 구성 (상위 5)</h3>
          <button type="button">더보기</button>
        </div>
        <div className="portfolio-body">
          <div
            className="donut"
            style={{ '--donut': donutStops.parts.join(', ') }}
            aria-label="구성종목 비중 도넛 차트"
          />
          <div className="holding-list">
            {selectedEtf.holdings.map(([name, weight, color]) => (
              <div className="holding-row" key={name}>
                <span style={{ '--dot-color': color }} />
                <strong>{name}</strong>
                <em>{weight.toFixed(2)}%</em>
              </div>
            ))}
            <div className="holding-row muted">
              <span style={{ '--dot-color': '#c9d1d9' }} />
              <strong>기타</strong>
              <em>{otherHoldings.toFixed(2)}%</em>
            </div>
          </div>
        </div>
      </section>

      <section className="risk-block">
        <h3>위험 지표</h3>
        <dl>
          <div>
            <dt>변동성 (3년 연환산)</dt>
            <dd>{selectedEtf.volatility.toFixed(2)}% <span>{riskTone}</span></dd>
          </div>
          <div>
            <dt>최대낙폭 (3년)</dt>
            <dd>{selectedEtf.drawdown.toFixed(2)}%</dd>
          </div>
          <div>
            <dt>추적오차 (3년)</dt>
            <dd>{selectedEtf.tracking.toFixed(2)}% <span>낮음</span></dd>
          </div>
          <div>
            <dt>정보비율 (3년)</dt>
            <dd>{selectedEtf.informationRatio.toFixed(2)}</dd>
          </div>
        </dl>
      </section>

      <section className="risk-note">
        <AlertTriangle size={18} />
        <div>
          <h3>리스크 노트</h3>
          <p>테마형·기술주 중심 ETF는 금리와 실적 기대 변화에 민감합니다.</p>
          <p>환율 변동에 따라 원화 수익률은 달라질 수 있습니다.</p>
        </div>
      </section>
    </aside>
  );
}

function RankingPanel({ filteredEtfs }) {
  const [tab, setTab] = useState('전체');
  const ranked = useMemo(() => {
    return filteredEtfs
      .filter((item) => tab === '전체' || item.market === tab)
      .slice()
      .sort((a, b) => b.returns.y1 - a.returns.y1)
      .slice(0, 5);
  }, [filteredEtfs, tab]);

  return (
    <section className="bottom-panel" id="ranking">
      <div className="section-heading">
        <h3>수익률 랭킹 (1년)</h3>
        <select aria-label="랭킹 기준">
          <option>TOP 5</option>
          <option>TOP 10</option>
        </select>
      </div>
      <div className="tabs" role="tablist" aria-label="시장 탭">
        {['전체', '국내', '미국'].map((item) => (
          <button
            className={tab === item ? 'active' : ''}
            type="button"
            key={item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="ranking-list">
        {ranked.map((item, index) => (
          <div className="ranking-row" key={item.id}>
            <span>{index + 1}</span>
            <strong>{item.short}</strong>
            <em>{item.provider}</em>
            <b className={item.returns.y1 >= 0 ? 'positive' : 'negative'}>
              {item.returns.y1 > 0 ? '+' : ''}{item.returns.y1.toFixed(2)}%
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}

function SimpleListPanel({ title, items, columns }) {
  return (
    <section className="bottom-panel">
      <div className="section-heading">
        <h3>{title}</h3>
        <button type="button">더보기</button>
      </div>
      <div className="compact-table">
        <div className="compact-head">
          {columns.map((column) => <span key={column}>{column}</span>)}
        </div>
        {items.map((item) => (
          <div className="compact-row" key={item.id}>
            <strong>{item.short}</strong>
            <span>{item.market}</span>
            <span>{item.asset}</span>
            <span className={item.returns.y1 >= 0 ? 'positive' : 'negative'}>
              {item.returns.y1 > 0 ? '+' : ''}{item.returns.y1.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function UniverseStrip({ filteredEtfs, selectedIds, setSelectedIds, setActiveId }) {
  const candidates = filteredEtfs.slice(0, 8);

  return (
    <section className="universe-strip">
      <div className="section-heading">
        <h3>검색 결과</h3>
        <span>필터 조건에 맞는 ETF를 비교 바구니에 추가하세요.</span>
      </div>
      <div className="universe-list">
        {candidates.map((item) => {
          const selected = selectedIds.includes(item.id);
          return (
            <button
              className={selected ? 'selected' : ''}
              key={item.id}
              type="button"
              onClick={() => {
                if (selected) {
                  setActiveId(item.id);
                  return;
                }
                setSelectedIds((current) => [...current, item.id].slice(-4));
                setActiveId(item.id);
              }}
            >
              <span>{item.short}</span>
              <em>{item.category}</em>
              <b className={item.change >= 0 ? 'positive' : 'negative'}>
                {item.change > 0 ? '+' : ''}{item.change}%
              </b>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    market: '시장 전체',
    theme: '테마 전체',
    provider: '운용사 전체',
    risk: '리스크 전체',
  });
  const [selectedIds, setSelectedIds] = useState(['360750', 'QQQ', 'VTI']);
  const [activeId, setActiveId] = useState('360750');
  const [favorites, setFavorites] = useState(['360750', 'QQQ', 'VTI', 'SCHD']);
  const [actionNote, setActionNote] = useState('');

  const filteredEtfs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return etfs.filter((etf) => {
      const searchable = `${etf.name} ${etf.short} ${etf.provider} ${etf.category} ${etf.theme} ${etf.id}`.toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesMarket = filters.market === '시장 전체' || etf.market === filters.market;
      const matchesTheme = filters.theme === '테마 전체' || etf.theme === filters.theme;
      const matchesProvider = filters.provider === '운용사 전체' || etf.provider === filters.provider;
      const matchesRisk = filters.risk === '리스크 전체' || getRiskBand(etf) === filters.risk;
      return matchesQuery && matchesMarket && matchesTheme && matchesProvider && matchesRisk;
    });
  }, [query, filters]);

  const selectedEtfs = useMemo(() => {
    return selectedIds.map((id) => etfs.find((etf) => etf.id === id)).filter(Boolean);
  }, [selectedIds]);

  const selectedEtf = selectedEtfs.find((etf) => etf.id === activeId) || selectedEtfs[0] || etfs[0];

  const addNext = () => {
    const next = filteredEtfs.find((etf) => !selectedIds.includes(etf.id));
    if (!next) {
      setActionNote('추가할 ETF가 없습니다. 필터를 조정해보세요.');
      return;
    }
    const nextIds = [...selectedIds, next.id].slice(-4);
    setSelectedIds(nextIds);
    setActiveId(next.id);
    setActionNote(`${next.name}을 비교 바구니에 추가했습니다.`);
  };

  const removeEtf = (id) => {
    if (selectedIds.length === 1) {
      setActionNote('비교표에는 최소 1개의 ETF가 필요합니다.');
      return;
    }
    const nextIds = selectedIds.filter((selectedId) => selectedId !== id);
    setSelectedIds(nextIds);
    if (activeId === id) {
      setActiveId(nextIds[0]);
    }
  };

  const handleSelect = (id) => {
    if (id === 'add-next') {
      addNext();
      return;
    }
    setActiveId(id);
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
    setFilters({
      market: '시장 전체',
      theme: '테마 전체',
      provider: '운용사 전체',
      risk: '리스크 전체',
    });
    setActionNote('검색 조건을 초기화했습니다.');
  };

  return (
    <div className="app-shell" id="dashboard">
      <Sidebar selectedIds={selectedIds} favorites={favorites} />
      <div className="main-shell">
        <TopBar query={query} onQueryChange={setQuery} />
        <main className="content-grid">
          <div className="workspace">
            <ComparisonHeader
              selectedIds={selectedIds}
              onAddNext={addNext}
              onClearFilters={clearFilters}
              filters={filters}
              setFilters={setFilters}
              resultCount={filteredEtfs.length}
              actionNote={actionNote}
              setActionNote={setActionNote}
            />
            <ComparisonGrid
              selectedEtfs={selectedEtfs}
              activeId={selectedEtf.id}
              onSelect={handleSelect}
              onRemove={removeEtf}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
            />
            <UniverseStrip
              filteredEtfs={filteredEtfs}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              setActiveId={setActiveId}
            />
            <div className="bottom-grid">
              <RankingPanel filteredEtfs={filteredEtfs.length ? filteredEtfs : etfs} />
              <SimpleListPanel
                title="최근 조회"
                columns={['ETF명', '시장', '자산군', '1년 수익률']}
                items={[etfs[7], etfs[1], etfs[9], etfs[2], etfs[5]]}
              />
              <SimpleListPanel
                title="관심상품"
                columns={['ETF명', '시장', '자산군', '1년 수익률']}
                items={etfs.filter((etf) => favorites.includes(etf.id)).slice(0, 5)}
              />
            </div>
          </div>
          <AnalysisPanel
            selectedEtf={selectedEtf}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
        </main>
        <footer className="site-footer">
          <span>본 화면의 가격·수익률은 서비스 데모용 예시 데이터입니다.</span>
          <span>투자 판단의 최종 책임은 투자자 본인에게 있습니다.</span>
          <a href="#risk">위험 고지</a>
        </footer>
      </div>
    </div>
  );
}
