import { describe, expect, it } from 'vitest';
import { scoreEtfs } from './scoring.js';

describe('scoreEtfs', () => {
  const baseEtf = {
    id: 'BASE',
    expenseRatio: 0.1,
    aum: 10_000_000_000,
    returns: { y1: 10, y3Annualized: 8, y5Annualized: 7 },
    risk: {
      volatility3yAnnualized: 12,
      maxDrawdown3y: -15,
      sharpe3y: 0.8,
      trackingError3y: null,
      informationRatio3y: null,
    },
    holdings: [
      { name: 'A', weight: 10 },
      { name: 'B', weight: 8 },
    ],
  };

  it('creates deterministic 0-100 scores', () => {
    const scored = scoreEtfs([
      baseEtf,
      {
        ...baseEtf,
        id: 'BETTER',
        expenseRatio: 0.03,
        aum: 100_000_000_000,
        returns: { y1: 20, y3Annualized: 15, y5Annualized: 12 },
        risk: { ...baseEtf.risk, volatility3yAnnualized: 10, maxDrawdown3y: -10, sharpe3y: 1.2 },
      },
    ]);

    expect(scored[0].aiynScore).toBeGreaterThanOrEqual(0);
    expect(scored[0].aiynScore).toBeLessThanOrEqual(100);
    expect(scored[1].aiynScore).toBeGreaterThan(scored[0].aiynScore);
    expect(scored[1].scoreBreakdown.총보수).toBeGreaterThan(scored[0].scoreBreakdown.총보수);
  });

  it('redistributes weights instead of treating missing fields as zero', () => {
    const [scored] = scoreEtfs([
      {
        ...baseEtf,
        risk: { ...baseEtf.risk, trackingError3y: null, informationRatio3y: null },
      },
    ]);

    expect(scored.aiynScore).toBeGreaterThan(0);
    expect(scored.scoreCoverage).toBeLessThan(1);
  });
});
