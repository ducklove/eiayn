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

  it('uses 3-month returns in the profitability component', () => {
    const [slow, fast] = scoreEtfs([
      { ...baseEtf, id: 'SLOW', returns: { m3: 1, y1: 10, y3Annualized: null, y5Annualized: null } },
      { ...baseEtf, id: 'FAST', returns: { m3: 20, y1: 10, y3Annualized: null, y5Annualized: null } },
    ]);

    expect(fast.scoreBreakdown.수익성).toBeGreaterThan(slow.scoreBreakdown.수익성);
  });

  it('keeps strong performers high when one leveraged outlier sets an extreme return', () => {
    const peers = Array.from({ length: 98 }, (_, index) => ({
      ...baseEtf,
      id: `PEER-${index}`,
      returns: { m3: index % 30, y1: index, y3Annualized: null, y5Annualized: null },
    }));
    const scored = scoreEtfs([
      ...peers,
      { ...baseEtf, id: 'STRONG', returns: { m3: 55, y1: 421, y3Annualized: null, y5Annualized: null } },
      { ...baseEtf, id: 'OUTLIER', returns: { m3: 1092, y1: 3142, y3Annualized: null, y5Annualized: null } },
    ]);
    const strong = scored.find((etf) => etf.id === 'STRONG');

    expect(strong.scoreBreakdown.수익성).toBeGreaterThan(95);
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
