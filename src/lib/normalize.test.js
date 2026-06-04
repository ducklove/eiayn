import { describe, expect, it } from 'vitest';
import { collectMissingFields, normalizeEtfInput } from './normalize.js';

describe('normalize utilities', () => {
  it('normalizes numeric strings and holdings', () => {
    const normalized = normalizeEtfInput({
      price: '100',
      changePercent: '1.2',
      expenseRatio: '0.03',
      aum: '1000000',
      dividendYield: '',
      returns: { m3: '2', y1: '3', y3Annualized: '4', y5Annualized: null },
      risk: {
        volatility3yAnnualized: '10',
        maxDrawdown3y: '-15',
        sharpe3y: '0.7',
        trackingError3y: null,
        informationRatio3y: null,
      },
      holdings: [{ name: ' A ', ticker: ' AAA ', weight: '5.5' }],
    });

    expect(normalized.price).toBe(100);
    expect(normalized.dividendYield).toBeNull();
    expect(normalized.holdings).toEqual([{ name: 'A', ticker: 'AAA', weight: 5.5 }]);
  });

  it('collects missing fields without inventing values', () => {
    const missing = collectMissingFields({
      price: 10,
      changePercent: null,
      expenseRatio: null,
      aum: 100,
      dividendYield: 1,
      inceptionDate: '2020-01-01',
      nav: null,
      returns: { m3: 1, y1: 2, y3Annualized: null, y5Annualized: null },
      risk: {
        volatility3yAnnualized: 10,
        maxDrawdown3y: -10,
        sharpe3y: 0.5,
        trackingError3y: null,
        informationRatio3y: null,
      },
      holdings: [],
    });

    expect(missing).toContain('changePercent');
    expect(missing).toContain('holdings');
    expect(missing).not.toContain('price');
  });
});
