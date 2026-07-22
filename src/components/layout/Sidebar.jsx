import {
  BriefcaseBusiness,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { formatDateTime, formatPercent, formatPrice } from '../../lib/format.js';
import { etfDeepLink, handleEtfLinkClick } from '../../lib/links.js';

export function Sidebar({
  selectedIds,
  favorites,
  recentEtfs,
  generatedAt,
  viewMode,
  onShowCompare,
  onShowAnalysis,
  onOpenEtf,
}) {
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
        <a
          className={viewMode === 'compare' ? 'active' : ''}
          href="#dashboard"
          onClick={(event) => {
            event.preventDefault();
            onShowCompare();
          }}
        >
          <LayoutDashboard size={18} />
          대시보드
        </a>
        <a
          className={viewMode === 'analysis' ? 'active' : ''}
          href="#model"
          onClick={(event) => {
            event.preventDefault();
            onShowAnalysis();
          }}
        >
          <WalletCards size={18} />
          ETF 분석
        </a>
        <a href="#model">
          <ShieldCheck size={18} />
          평가 모델
        </a>
        <a href="#ranking">
          <TrendingUp size={18} />
          수익률 랭킹
        </a>
        <a href="#search">
          <Search size={18} />
          ETF 검색
        </a>
        <a href="#holdings">
          <SlidersHorizontal size={18} />
          구성종목 검색
        </a>
        <a href="#favorites">
          <Star size={18} />
          관심상품
        </a>
        <a href="#model">
          <BriefcaseBusiness size={18} />
          선택 ETF <strong>{selectedIds.length}</strong>
        </a>
        <a href="#risk">
          <Settings size={18} />
          투자 유의
        </a>
      </nav>

      <section className="watchlist" id="favorites" aria-labelledby="watchlist-title">
        <div className="section-heading">
          <h2 id="watchlist-title">관심상품 ({favorites.length})</h2>
          <button type="button" disabled title="관심상품은 각 ETF의 별 버튼으로 관리합니다.">
            편집
          </button>
        </div>
        <div className="watchlist-items">
          {favorites.slice(0, 6).map((item) => (
            <a
              className="watch-row"
              href={etfDeepLink(item.id)}
              key={item.id}
              onClick={(event) => handleEtfLinkClick(event, item.id, onOpenEtf)}
            >
              <span className="dot" />
              <div>
                <strong>{item.shortName}</strong>
                <small>{item.id}</small>
              </div>
              <p>
                {formatPrice(item.price, item.currency)}
                <span className={item.changePercent >= 0 ? 'positive' : 'negative'}>
                  {formatPercent(item.changePercent)}
                </span>
              </p>
            </a>
          ))}
          {!favorites.length && <p className="empty-side">관심상품이 없습니다.</p>}
        </div>
      </section>

      <section className="recent-mini" aria-labelledby="recent-title">
        <div className="section-heading">
          <h2 id="recent-title">최근 조회</h2>
          <button type="button" disabled title="최근 조회는 ETF 선택 시 자동 기록됩니다.">
            더보기
          </button>
        </div>
        {recentEtfs.slice(0, 3).map((item) => (
          <a
            className="recent-row"
            href={etfDeepLink(item.id)}
            key={item.id}
            onClick={(event) => handleEtfLinkClick(event, item.id, onOpenEtf)}
          >
            <strong>{item.shortName}</strong>
            <span>{item.provider}</span>
          </a>
        ))}
        {!recentEtfs.length && <p className="empty-side">조회 기록이 없습니다.</p>}
      </section>

      <div className="data-note">
        <span>출처: 네이버 금융, Yahoo Finance, StockAnalysis</span>
        <span>마지막 업데이트: {formatDateTime(generatedAt)} KST</span>
      </div>
    </aside>
  );
}
