import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Star } from 'lucide-react';
import {
  formatAum,
  formatPercent,
  formatPlainPercent,
  formatPrice,
  returnTone,
} from '../../lib/format.js';
import { etfDeepLink, handleEtfLinkClick } from '../../lib/links.js';
import { sortEtfs } from '../../lib/sort.js';

const PAGE_SIZE = 50;

// Mixed-currency columns (price, AUM) are display-only on purpose:
// sorting raw KRW against USD/JPY values would be misleading.
const COLUMNS = [
  { key: 'name', label: 'ETF', sortable: true, type: 'name' },
  { key: 'market', label: '시장', sortable: true, type: 'text' },
  { key: 'price', label: '현재가', sortable: false, type: 'price' },
  { key: 'changePercent', label: '등락', sortable: true, type: 'signedPercent' },
  { key: 'expenseRatio', label: '총보수', sortable: true, type: 'percent' },
  { key: 'dividendYield', label: '배당 (연)', sortable: true, type: 'percent' },
  { key: 'returns.y1', label: '1년', sortable: true, type: 'signedPercent' },
  { key: 'returns.y3Annualized', label: '3년 (연환산)', sortable: true, type: 'signedPercent' },
  { key: 'aum', label: 'AUM', sortable: false, type: 'aum' },
  { key: 'aiynScore', label: 'AIYN', sortable: true, type: 'score' },
  { key: 'scoreCoverage', label: '충족도', sortable: true, type: 'coverage' },
];

export function EtfTable({
  etfs,
  favorites,
  toggleFavorite,
  onOpenEtf,
  onAddCompare,
  selectedIds,
}) {
  const [sortKey, setSortKey] = useState('aiynScore');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => sortEtfs(etfs, sortKey, sortDir), [etfs, sortKey, sortDir]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [etfs, sortKey, sortDir]);

  const currentPage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleSort = (column) => {
    if (!column.sortable) return;
    if (column.key === sortKey) {
      setSortDir((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(column.key);
    setSortDir(column.type === 'name' || column.type === 'text' ? 'asc' : 'desc');
  };

  return (
    <section className="etf-table-block" aria-labelledby="etf-table-title">
      <div className="section-heading">
        <h3 id="etf-table-title">전체 목록 ({sorted.length})</h3>
        <span>검색·필터 결과 전체를 정렬해 탐색합니다. 행을 누르면 개별 분석이 열립니다.</span>
      </div>
      <div className="table-scroll">
        <table className="etf-table">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} aria-sort={ariaSort(column, sortKey, sortDir)}>
                  {column.sortable ? (
                    <button type="button" onClick={() => handleSort(column)}>
                      {column.label}
                      <SortIcon column={column} sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((etf) => (
              <tr key={etf.id} onClick={() => onOpenEtf(etf.id)}>
                <td className="name-cell">
                  <a
                    href={etfDeepLink(etf.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleEtfLinkClick(event, etf.id, onOpenEtf);
                    }}
                  >
                    <strong>{etf.shortName}</strong>
                    <small>
                      {etf.id} · {etf.provider ?? '-'}
                    </small>
                  </a>
                </td>
                <td>{etf.market}</td>
                <td className="num">{formatPrice(etf.price, etf.currency)}</td>
                <td className={`num ${returnTone(etf.changePercent) ?? ''}`}>
                  {formatPercent(etf.changePercent)}
                </td>
                <td className="num">{formatPlainPercent(etf.expenseRatio)}</td>
                <td className="num">{formatPlainPercent(etf.dividendYield)}</td>
                <td className={`num ${returnTone(etf.returns?.y1) ?? ''}`}>
                  {formatPercent(etf.returns?.y1)}
                </td>
                <td className={`num ${returnTone(etf.returns?.y3Annualized) ?? ''}`}>
                  {formatPercent(etf.returns?.y3Annualized)}
                </td>
                <td className="num">{formatAum(etf.aum, etf.currency)}</td>
                <td className="num score-cell">{etf.aiynScore ?? '-'}</td>
                <td className="num">
                  {typeof etf.scoreCoverage === 'number'
                    ? `${Math.round(etf.scoreCoverage * 100)}%`
                    : '-'}
                </td>
                <td className="action-cell">
                  <button
                    className={`icon-button small ${favorites.includes(etf.id) ? 'selected-action' : ''}`}
                    type="button"
                    aria-label={`${etf.shortName} 관심상품 토글`}
                    title="관심상품"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFavorite(etf.id);
                    }}
                  >
                    <Star size={15} />
                  </button>
                  <button
                    className="icon-button small"
                    type="button"
                    aria-label={`${etf.shortName} 비교 추가`}
                    title={selectedIds.includes(etf.id) ? '이미 비교 중' : '비교 바구니에 추가'}
                    disabled={selectedIds.includes(etf.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddCompare(etf.id);
                    }}
                  >
                    <Plus size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="empty-state">검색 조건에 맞는 ETF가 없습니다.</p>}
      </div>
      {pageCount > 1 && (
        <div className="table-pager">
          <button
            className="ghost-button slim"
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            이전
          </button>
          <span>
            {currentPage + 1} / {pageCount} 페이지
          </span>
          <button
            className="ghost-button slim"
            type="button"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            다음
          </button>
        </div>
      )}
    </section>
  );
}

function ariaSort(column, sortKey, sortDir) {
  if (column.key !== sortKey) return undefined;
  return sortDir === 'asc' ? 'ascending' : 'descending';
}

function SortIcon({ column, sortKey, sortDir }) {
  if (column.key !== sortKey) return <ArrowUpDown size={13} aria-hidden="true" />;
  return sortDir === 'asc' ? (
    <ArrowUp size={13} aria-hidden="true" />
  ) : (
    <ArrowDown size={13} aria-hidden="true" />
  );
}
