// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EtfAnalysisDashboard } from './EtfAnalysisDashboard.jsx';

vi.mock('../../hooks/useDataFile.js', () => ({
  useDataFile: () => ({ data: null, loading: false }),
}));

function makeEtf(overrides = {}) {
  return {
    id: '069500',
    shortName: 'KODEX 200',
    name: 'KODEX 200',
    provider: '삼성자산운용',
    benchmarkIndex: 'KOSPI 200',
    market: '국내',
    assetClass: '주식',
    category: '국내 대형주',
    currency: 'KRW',
    price: 36000,
    changePercent: 0.5,
    expenseRatio: 0.15,
    dividendYield: 1.8,
    aum: 5_000_000_000_000,
    inceptionDate: '2002-10-14',
    nav: null,
    aiynScore: 82,
    scoreCoverage: 1,
    scoreBreakdown: { 가치: 60, 안정성: 80 },
    returns: { m3: 2.1, y1: 11.2, y3Annualized: 8.4, y5Annualized: 7.9 },
    risk: {
      volatility3yAnnualized: 14.2,
      maxDrawdown3y: -22.1,
      sharpe3y: 0.6,
      trackingError3y: null,
      informationRatio3y: null,
    },
    holdings: [],
    sparkline: [1, 2, 3],
    dataQuality: { quoteAsOf: '2026-06-09T08:00:00.000Z' },
    ...overrides,
  };
}

function renderDashboard(etf) {
  return render(
    <EtfAnalysisDashboard selectedEtf={etf} favorites={[]} toggleFavorite={() => {}} />,
  );
}

afterEach(cleanup);

describe('EtfAnalysisDashboard NAV / 괴리율 tiles', () => {
  it('shows NAV and premium-discount values for Korean ETFs when present', () => {
    renderDashboard(makeEtf({ nav: 36050, premiumDiscount: -0.14 }));
    expect(screen.getByText('NAV (기준가)')).toBeTruthy();
    expect(screen.getByText('36,050')).toBeTruthy();
    expect(screen.getByText('괴리율')).toBeTruthy();
    expect(screen.getByText('-0.14%')).toBeTruthy();
  });

  it('keeps honest dashes for Korean ETFs while the KRX data has not shipped', () => {
    renderDashboard(makeEtf());
    const navTile = screen.getByText('NAV (기준가)').closest('.metric-tile');
    expect(navTile.querySelector('strong').textContent).toBe('-');
    const premiumTile = screen.getByText('괴리율').closest('.metric-tile');
    expect(premiumTile.querySelector('strong').textContent).toBe('-');
  });

  it('omits the tiles for non-Korean ETFs where the metric is not collected', () => {
    renderDashboard(makeEtf({ market: '미국', currency: 'USD' }));
    expect(screen.queryByText('NAV (기준가)')).toBeNull();
    expect(screen.queryByText('괴리율')).toBeNull();
  });
});
