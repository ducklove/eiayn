import { describe, expect, it } from 'vitest';
import { buildPortfolioSummary } from './portfolio.js';

function makeEtf(overrides = {}) {
  return {
    id: '069500',
    shortName: 'KODEX 200',
    name: 'KODEX 200',
    expenseRatio: 0.15,
    dividendYield: 1.8,
    aiynScore: 82,
    theme: '국내 대표지수',
    market: 'KR',
    ...overrides,
  };
}

describe('buildPortfolioSummary', () => {
  it('returns null when there is no usable weight', () => {
    expect(buildPortfolioSummary([])).toBeNull();
    expect(buildPortfolioSummary(null)).toBeNull();
    expect(buildPortfolioSummary(undefined)).toBeNull();
    expect(buildPortfolioSummary([{ etf: makeEtf(), weight: 0 }])).toBeNull();
    expect(
      buildPortfolioSummary([
        { etf: makeEtf({ id: 'A' }), weight: 0 },
        { etf: makeEtf({ id: 'B' }), weight: -10 },
      ]),
    ).toBeNull();
    expect(buildPortfolioSummary([{ etf: makeEtf(), weight: Number.NaN }])).toBeNull();
  });

  it('normalizes weights that do not sum to 100', () => {
    const summary = buildPortfolioSummary([
      { etf: makeEtf({ id: 'A', expenseRatio: 0.1 }), weight: 30 },
      { etf: makeEtf({ id: 'B', expenseRatio: 0.5 }), weight: 90 },
    ]);
    // 30/120 = 25%, 90/120 = 75%
    expect(summary.expenseRatio.value).toBeCloseTo(0.1 * 0.25 + 0.5 * 0.75);
    expect(summary.expenseRatio.includedCount).toBe(2);
    expect(summary.expenseRatio.totalCount).toBe(2);
  });

  it('ignores zero-weight entries entirely', () => {
    const summary = buildPortfolioSummary([
      { etf: makeEtf({ id: 'A', expenseRatio: 0.1, theme: '국내' }), weight: 50 },
      { etf: makeEtf({ id: 'B', expenseRatio: 9.9, theme: '미국' }), weight: 0 },
    ]);
    expect(summary.expenseRatio.value).toBeCloseTo(0.1);
    expect(summary.expenseRatio.totalCount).toBe(1);
    expect(summary.themeBreakdown).toEqual([{ label: '국내', weight: 100 }]);
  });

  it('handles a single ETF as a 100% portfolio', () => {
    const summary = buildPortfolioSummary([{ etf: makeEtf(), weight: 40 }]);
    expect(summary.expenseRatio).toEqual({ value: 0.15, includedCount: 1, totalCount: 1 });
    expect(summary.dividendYield.value).toBeCloseTo(1.8);
    expect(summary.aiynScore.value).toBeCloseTo(82);
    expect(summary.themeBreakdown).toEqual([{ label: '국내 대표지수', weight: 100 }]);
    expect(summary.marketBreakdown).toEqual([{ label: 'KR', weight: 100 }]);
  });

  it('renormalizes each metric over the ETFs that have the field', () => {
    const summary = buildPortfolioSummary([
      { etf: makeEtf({ id: 'A', expenseRatio: 0.2, dividendYield: 2 }), weight: 50 },
      { etf: makeEtf({ id: 'B', expenseRatio: 0.6, dividendYield: null }), weight: 30 },
      { etf: makeEtf({ id: 'C', expenseRatio: null, dividendYield: null }), weight: 20 },
    ]);
    // Expense ratio: A/B only, weights 50/30 renormalized to 5/8 and 3/8.
    expect(summary.expenseRatio.value).toBeCloseTo(0.2 * (5 / 8) + 0.6 * (3 / 8));
    expect(summary.expenseRatio.includedCount).toBe(2);
    expect(summary.expenseRatio.totalCount).toBe(3);
    // Dividend yield: only A remains, so its value carries 100% weight.
    expect(summary.dividendYield.value).toBeCloseTo(2);
    expect(summary.dividendYield.includedCount).toBe(1);
    expect(summary.dividendYield.totalCount).toBe(3);
  });

  it('returns a null value with zero coverage when no ETF has the field', () => {
    const summary = buildPortfolioSummary([
      { etf: makeEtf({ id: 'A', aiynScore: null }), weight: 60 },
      { etf: makeEtf({ id: 'B', aiynScore: null }), weight: 40 },
    ]);
    expect(summary.aiynScore).toEqual({ value: null, includedCount: 0, totalCount: 2 });
  });

  it('weights the AIYN score by normalized weight', () => {
    const summary = buildPortfolioSummary([
      { etf: makeEtf({ id: 'A', aiynScore: 90 }), weight: 75 },
      { etf: makeEtf({ id: 'B', aiynScore: 50 }), weight: 25 },
    ]);
    expect(summary.aiynScore.value).toBeCloseTo(80);
  });

  it('groups breakdowns by label, sorts descending, and rounds to 1 decimal', () => {
    const summary = buildPortfolioSummary([
      { etf: makeEtf({ id: 'A', theme: '미국 대표지수', market: 'US' }), weight: 1 },
      { etf: makeEtf({ id: 'B', theme: '국내 대표지수', market: 'KR' }), weight: 1 },
      { etf: makeEtf({ id: 'C', theme: '미국 대표지수', market: 'US' }), weight: 1 },
    ]);
    expect(summary.themeBreakdown).toEqual([
      { label: '미국 대표지수', weight: 66.7 },
      { label: '국내 대표지수', weight: 33.3 },
    ]);
    expect(summary.marketBreakdown).toEqual([
      { label: 'US', weight: 66.7 },
      { label: 'KR', weight: 33.3 },
    ]);
  });

  it('labels missing theme or market as 데이터 없음', () => {
    const summary = buildPortfolioSummary([
      { etf: makeEtf({ id: 'A', theme: null, market: null }), weight: 25 },
      { etf: makeEtf({ id: 'B', theme: 'AI', market: 'US' }), weight: 75 },
    ]);
    expect(summary.themeBreakdown).toEqual([
      { label: 'AI', weight: 75 },
      { label: '데이터 없음', weight: 25 },
    ]);
    expect(summary.marketBreakdown).toEqual([
      { label: 'US', weight: 75 },
      { label: '데이터 없음', weight: 25 },
    ]);
  });

  it('breaks breakdown ties with a stable label order', () => {
    const summary = buildPortfolioSummary([
      { etf: makeEtf({ id: 'A', market: 'US' }), weight: 50 },
      { etf: makeEtf({ id: 'B', market: 'KR' }), weight: 50 },
    ]);
    expect(summary.marketBreakdown).toEqual([
      { label: 'KR', weight: 50 },
      { label: 'US', weight: 50 },
    ]);
  });
});
