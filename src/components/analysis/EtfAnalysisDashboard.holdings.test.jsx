// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EtfAnalysisDashboard } from './EtfAnalysisDashboard.jsx';

vi.mock('../../hooks/useDataFile.js', () => ({
  useDataFile: () => ({ data: null, loading: false }),
}));

function makeHoldings(count) {
  return Array.from({ length: count }, (_, index) => ({
    name: `종목 ${index + 1}`,
    ticker: `T${String(index + 1).padStart(2, '0')}`,
    weight: 2,
  }));
}

function makeEtf(overrides = {}) {
  return {
    id: '069500',
    shortName: 'KODEX 200',
    name: 'KODEX 200',
    provider: '삼성자산운용',
    benchmarkIndex: 'KOSPI 200',
    market: 'KR',
    assetClass: '주식',
    category: '국내 대형주',
    currency: 'KRW',
    price: 36000,
    changePercent: 0.5,
    expenseRatio: 0.15,
    dividendYield: 1.8,
    aum: 5_000_000_000_000,
    inceptionDate: '2002-10-14',
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
    dataQuality: { quoteAsOf: '2026-06-09T08:00:00.000Z' },
    ...overrides,
  };
}

function renderDashboard(etf) {
  return render(<EtfAnalysisDashboard selectedEtf={etf} favorites={[]} toggleFavorite={vi.fn()} />);
}

function holdingRows(container) {
  return container.querySelectorAll('.wide-holding-row:not(.muted)');
}

afterEach(cleanup);

describe('EtfAnalysisDashboard holdings list', () => {
  it('renders without a toggle when there are 10 or fewer holdings', () => {
    const { container } = renderDashboard(makeEtf({ holdings: makeHoldings(10) }));
    expect(holdingRows(container)).toHaveLength(10);
    expect(screen.getByText('상위 10개')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /보유종목 보기/ })).toBeNull();
  });

  it('shows the empty state without a toggle when holdings are missing', () => {
    const { container } = renderDashboard(makeEtf({ holdings: [] }));
    expect(screen.getByText('보유종목 데이터 없음')).toBeTruthy();
    expect(holdingRows(container)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /보유종목 보기/ })).toBeNull();
  });

  it('expands to the full list and collapses back via the toggle', () => {
    const { container } = renderDashboard(makeEtf({ holdings: makeHoldings(25) }));
    expect(holdingRows(container)).toHaveLength(10);
    expect(screen.queryByText('종목 25')).toBeNull();

    const toggle = screen.getByRole('button', { name: '전체 보유종목 보기 (25)' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(holdingRows(container)).toHaveLength(25);
    expect(screen.getByText('종목 25')).toBeTruthy();
    expect(screen.getByText('전체 25개')).toBeTruthy();
    expect(toggle.textContent).toBe('상위 10개만 보기');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);
    expect(holdingRows(container)).toHaveLength(10);
    expect(screen.queryByText('종목 25')).toBeNull();
    expect(screen.getByText('상위 10개')).toBeTruthy();
  });

  it('keeps the donut on the top 10 and recomputes 기타 for the visible rows', () => {
    const { container } = renderDashboard(makeEtf({ holdings: makeHoldings(25) }));
    const donutStyle = container.querySelector('.donut.large').getAttribute('style');
    expect(container.querySelector('.wide-holding-row.muted b').textContent).toBe('80.00%');

    fireEvent.click(screen.getByRole('button', { name: '전체 보유종목 보기 (25)' }));
    expect(container.querySelector('.donut.large').getAttribute('style')).toBe(donutStyle);
    expect(container.querySelector('.wide-holding-row.muted b').textContent).toBe('50.00%');
  });

  it('collapses again when a different ETF is selected', () => {
    const first = makeEtf({ holdings: makeHoldings(25) });
    const second = makeEtf({ id: 'SPY', name: 'SPDR S&P 500', holdings: makeHoldings(20) });
    const { container, rerender } = renderDashboard(first);

    fireEvent.click(screen.getByRole('button', { name: '전체 보유종목 보기 (25)' }));
    expect(holdingRows(container)).toHaveLength(25);

    rerender(<EtfAnalysisDashboard selectedEtf={second} favorites={[]} toggleFavorite={vi.fn()} />);
    expect(holdingRows(container)).toHaveLength(10);
    expect(screen.getByRole('button', { name: '전체 보유종목 보기 (20)' })).toBeTruthy();
  });
});
