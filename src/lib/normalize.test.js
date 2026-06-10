import { describe, expect, it } from 'vitest';
import { collectMissingFields } from './normalize.js';

describe('normalize utilities', () => {
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
