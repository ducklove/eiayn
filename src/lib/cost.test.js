import { describe, expect, it } from 'vitest';
import { estimateHoldingCost } from './cost.js';

describe('estimateHoldingCost', () => {
  it('computes annual and cumulative cost linearly', () => {
    const cost = estimateHoldingCost({ amount: 10_000_000, years: 5, expenseRatio: 0.5 });
    expect(cost.annual).toBeCloseTo(50_000);
    expect(cost.total).toBeCloseTo(250_000);
  });

  it('handles a zero expense ratio', () => {
    const cost = estimateHoldingCost({ amount: 1_000_000, years: 3, expenseRatio: 0 });
    expect(cost.annual).toBe(0);
    expect(cost.total).toBe(0);
  });

  it('returns null for missing or invalid inputs', () => {
    expect(estimateHoldingCost({ amount: 0, years: 5, expenseRatio: 0.5 })).toBeNull();
    expect(estimateHoldingCost({ amount: 100, years: -1, expenseRatio: 0.5 })).toBeNull();
    expect(estimateHoldingCost({ amount: 100, years: 5, expenseRatio: null })).toBeNull();
    expect(estimateHoldingCost({ amount: NaN, years: 5, expenseRatio: 0.5 })).toBeNull();
  });
});
