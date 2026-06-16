// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { EtfTable } from './EtfTable.jsx';

function makeEtf(overrides = {}) {
  return {
    id: '069500',
    shortName: 'KODEX 200',
    name: 'KODEX 200',
    provider: '삼성자산운용',
    market: 'KR',
    currency: 'KRW',
    price: 36000,
    changePercent: 0.5,
    expenseRatio: 0.15,
    dividendYield: 1.8,
    aum: 5_000_000_000_000,
    aiynScore: 82,
    scoreCoverage: 1,
    scoreBreakdown: {
      '단기 수익': 70,
      '장기 수익': 75,
      가치: 60,
      안정성: 80,
      분산: 90,
      효율성: 85,
    },
    returns: { m3: 2.1, y1: 11.2, y3Annualized: 8.4, y5Annualized: 7.9 },
    risk: {
      volatility3yAnnualized: 14.2,
      maxDrawdown3y: -22.1,
      sharpe3y: 0.6,
      trackingError3y: 0.8,
      informationRatio3y: 0.2,
    },
    holdings: [],
    sparkline: [1, 2, 3],
    ...overrides,
  };
}

const alpha = makeEtf({
  id: 'AAA',
  shortName: 'Alpha',
  market: 'KR',
  aiynScore: 90,
  changePercent: -2.5,
});
const bravo = makeEtf({
  id: 'BBB',
  shortName: 'Bravo',
  market: 'US',
  currency: 'USD',
  aiynScore: 70,
  changePercent: 3.1,
});
const charlie = makeEtf({
  id: 'CCC',
  shortName: 'Charlie',
  market: 'JP',
  currency: 'JPY',
  aiynScore: null,
  changePercent: 0.4,
});

function renderTable(etfs, { favorites = [], selectedIds = [] } = {}) {
  const handlers = {
    toggleFavorite: vi.fn(),
    onOpenEtf: vi.fn(),
    onAddCompare: vi.fn(),
  };
  const utils = render(
    <EtfTable etfs={etfs} favorites={favorites} selectedIds={selectedIds} {...handlers} />,
  );
  return { ...utils, ...handlers };
}

function rowNames(container) {
  return Array.from(container.querySelectorAll('tbody .name-cell strong')).map(
    (node) => node.textContent,
  );
}

afterEach(cleanup);

describe('EtfTable rendering', () => {
  it('renders a row per ETF with formatted cells', () => {
    const { container } = renderTable([makeEtf()]);
    expect(screen.getByRole('heading', { name: '전체 목록 (1)' })).toBeTruthy();

    const row = container.querySelector('tbody tr');
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(12);
    expect(within(cells[0]).getByText('KODEX 200')).toBeTruthy();
    expect(cells[0].querySelector('small').textContent).toBe('069500 · 삼성자산운용');
    expect(cells[1].textContent).toBe('KR');
    expect(cells[2].textContent).toBe('36,000');
    expect(cells[3].textContent).toBe('+0.50%');
    expect(cells[3].classList.contains('positive')).toBe(true);
    expect(cells[4].textContent).toBe('0.15%');
    expect(cells[5].textContent).toBe('1.80%');
    expect(cells[6].textContent).toBe('+11.20%');
    expect(cells[7].textContent).toBe('+8.40%');
    expect(cells[8].textContent).toBe('5T');
    expect(cells[9].textContent).toBe('82');
    expect(cells[10].textContent).toBe('100%');
  });

  it('renders dashes for missing values', () => {
    const sparse = makeEtf({
      provider: null,
      price: null,
      changePercent: null,
      expenseRatio: null,
      dividendYield: null,
      returns: { m3: null, y1: null, y3Annualized: null, y5Annualized: null },
      aum: null,
      aiynScore: null,
      scoreCoverage: null,
    });
    const { container } = renderTable([sparse]);
    const cells = within(container.querySelector('tbody tr')).getAllByRole('cell');
    expect(cells[0].querySelector('small').textContent).toBe('069500 · -');
    for (const index of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      expect(cells[index].textContent).toBe('-');
    }
    expect(cells[3].classList.contains('positive')).toBe(false);
    expect(cells[3].classList.contains('negative')).toBe(false);
  });

  it('links the name cell to the code deep link', () => {
    const { container } = renderTable([makeEtf({ id: 'A&B' })]);
    const link = within(container.querySelector('tbody tr')).getByRole('link');
    expect(link.getAttribute('href')).toBe('?code=A%26B');
  });

  it('shows the empty state when no ETFs match', () => {
    renderTable([]);
    expect(screen.getByRole('heading', { name: '전체 목록 (0)' })).toBeTruthy();
    expect(screen.getByText('검색 조건에 맞는 ETF가 없습니다.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '다음' })).toBeNull();
  });
});

describe('EtfTable sorting', () => {
  it('sorts by AIYN score descending by default with nulls last', () => {
    const { container } = renderTable([charlie, bravo, alpha]);
    expect(rowNames(container)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(screen.getByRole('columnheader', { name: 'AIYN' }).getAttribute('aria-sort')).toBe(
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: '시장' }).getAttribute('aria-sort')).toBeNull();
  });

  it('toggles direction when the active column is clicked again, keeping nulls last', () => {
    const { container } = renderTable([charlie, bravo, alpha]);
    fireEvent.click(screen.getByRole('button', { name: 'AIYN' }));
    expect(rowNames(container)).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(screen.getByRole('columnheader', { name: 'AIYN' }).getAttribute('aria-sort')).toBe(
      'ascending',
    );
    fireEvent.click(screen.getByRole('button', { name: 'AIYN' }));
    expect(rowNames(container)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(screen.getByRole('columnheader', { name: 'AIYN' }).getAttribute('aria-sort')).toBe(
      'descending',
    );
  });

  it('sorts a newly selected numeric column descending', () => {
    const { container } = renderTable([charlie, bravo, alpha]);
    fireEvent.click(screen.getByRole('button', { name: '등락' }));
    expect(rowNames(container)).toEqual(['Bravo', 'Charlie', 'Alpha']);
    expect(screen.getByRole('columnheader', { name: '등락' }).getAttribute('aria-sort')).toBe(
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: 'AIYN' }).getAttribute('aria-sort')).toBeNull();
  });

  it('sorts a newly selected text column ascending', () => {
    const { container } = renderTable([charlie, bravo, alpha]);
    fireEvent.click(screen.getByRole('button', { name: '시장' }));
    expect(rowNames(container)).toEqual(['Charlie', 'Alpha', 'Bravo']);
    expect(screen.getByRole('columnheader', { name: '시장' }).getAttribute('aria-sort')).toBe(
      'ascending',
    );
  });
});

describe('EtfTable pagination', () => {
  const many = Array.from({ length: 55 }, (_, index) =>
    makeEtf({
      id: `E${String(index).padStart(2, '0')}`,
      shortName: `ETF ${String(index).padStart(2, '0')}`,
      aiynScore: 100 - index,
    }),
  );

  it('shows 50 rows per page with the pager state', () => {
    const { container } = renderTable(many);
    const names = rowNames(container);
    expect(names).toHaveLength(50);
    expect(names[0]).toBe('ETF 00');
    expect(names[49]).toBe('ETF 49');
    expect(screen.getByText('1 / 2 페이지')).toBeTruthy();
    expect(screen.getByRole('button', { name: '이전' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: '다음' }).disabled).toBe(false);
  });

  it('moves between pages with 다음 and 이전', () => {
    const { container } = renderTable(many);
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(rowNames(container)).toEqual(['ETF 50', 'ETF 51', 'ETF 52', 'ETF 53', 'ETF 54']);
    expect(screen.getByText('2 / 2 페이지')).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: '이전' }).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(rowNames(container)).toHaveLength(50);
    expect(screen.getByText('1 / 2 페이지')).toBeTruthy();
  });

  it('resets to the first page when the sort changes', () => {
    const { container } = renderTable(many);
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText('2 / 2 페이지')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'AIYN' }));
    expect(screen.getByText('1 / 2 페이지')).toBeTruthy();
    expect(rowNames(container)[0]).toBe('ETF 54');
  });

  it('hides the pager when everything fits on one page', () => {
    renderTable([alpha, bravo]);
    expect(screen.queryByText(/페이지/)).toBeNull();
  });
});

describe('EtfTable row actions', () => {
  it('opens the ETF when a row is clicked', () => {
    const { container, onOpenEtf } = renderTable([alpha]);
    fireEvent.click(container.querySelector('tbody tr'));
    expect(onOpenEtf).toHaveBeenCalledTimes(1);
    expect(onOpenEtf).toHaveBeenCalledWith('AAA');
  });

  it('opens the ETF exactly once via the name link', () => {
    const { container, onOpenEtf } = renderTable([alpha]);
    fireEvent.click(within(container.querySelector('tbody tr')).getByRole('link'));
    expect(onOpenEtf).toHaveBeenCalledTimes(1);
    expect(onOpenEtf).toHaveBeenCalledWith('AAA');
  });

  it('toggles favorite from the star without opening the row', () => {
    const { onOpenEtf, toggleFavorite } = renderTable([alpha]);
    fireEvent.click(screen.getByRole('button', { name: 'Alpha 관심상품 토글' }));
    expect(toggleFavorite).toHaveBeenCalledTimes(1);
    expect(toggleFavorite).toHaveBeenCalledWith('AAA');
    expect(onOpenEtf).not.toHaveBeenCalled();
  });

  it('marks the star of favorited ETFs as selected', () => {
    renderTable([alpha, bravo], { favorites: ['AAA'] });
    const alphaStar = screen.getByRole('button', { name: 'Alpha 관심상품 토글' });
    const bravoStar = screen.getByRole('button', { name: 'Bravo 관심상품 토글' });
    expect(alphaStar.classList.contains('selected-action')).toBe(true);
    expect(bravoStar.classList.contains('selected-action')).toBe(false);
  });

  it('adds to compare without opening the row', () => {
    const { onAddCompare, onOpenEtf } = renderTable([alpha]);
    fireEvent.click(screen.getByRole('button', { name: 'Alpha 비교 추가' }));
    expect(onAddCompare).toHaveBeenCalledTimes(1);
    expect(onAddCompare).toHaveBeenCalledWith('AAA');
    expect(onOpenEtf).not.toHaveBeenCalled();
  });

  it('disables add-to-compare for already selected ETFs', () => {
    renderTable([alpha, bravo], { selectedIds: ['BBB'] });
    const bravoAdd = screen.getByRole('button', { name: 'Bravo 비교 추가' });
    const alphaAdd = screen.getByRole('button', { name: 'Alpha 비교 추가' });
    expect(bravoAdd.disabled).toBe(true);
    expect(bravoAdd.title).toBe('이미 비교 중');
    expect(alphaAdd.disabled).toBe(false);
    expect(alphaAdd.title).toBe('비교 바구니에 추가');
  });
});
