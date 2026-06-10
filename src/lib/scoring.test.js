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
    expect(scored[1].scoreBreakdown.총보수).toBeUndefined();
    expect(scored[1].scoreBreakdown.수익성).toBeUndefined();
    expect(scored[1].scoreBreakdown['장기 수익']).toBeGreaterThan(
      scored[0].scoreBreakdown['장기 수익'],
    );
    expect(scored[1].scoreBreakdown.가치).toBeGreaterThan(scored[0].scoreBreakdown.가치);
  });

  it('uses 30-day sparkline return in the short-term return component', () => {
    const [slow, fast] = scoreEtfs([
      {
        ...baseEtf,
        id: 'SLOW',
        sparkline: [100, 101],
        returns: { m3: 10, y1: 10, y3Annualized: null, y5Annualized: null },
      },
      {
        ...baseEtf,
        id: 'FAST',
        sparkline: [100, 130],
        returns: { m3: 10, y1: 10, y3Annualized: null, y5Annualized: null },
      },
    ]);

    expect(fast.scoreBreakdown['단기 수익']).toBeGreaterThan(slow.scoreBreakdown['단기 수익']);
  });

  it('uses 3-month returns in the short-term return component', () => {
    const [slow, fast] = scoreEtfs([
      {
        ...baseEtf,
        id: 'SLOW',
        sparkline: [100, 110],
        returns: { m3: 1, y1: 10, y3Annualized: null, y5Annualized: null },
      },
      {
        ...baseEtf,
        id: 'FAST',
        sparkline: [100, 110],
        returns: { m3: 20, y1: 10, y3Annualized: null, y5Annualized: null },
      },
    ]);

    expect(fast.scoreBreakdown['단기 수익']).toBeGreaterThan(slow.scoreBreakdown['단기 수익']);
  });

  it('uses 1-year, 3-year, and 5-year returns in the long-term return component', () => {
    const [slow, fast] = scoreEtfs([
      { ...baseEtf, id: 'SLOW', returns: { m3: 10, y1: 3, y3Annualized: 2, y5Annualized: 1 } },
      { ...baseEtf, id: 'FAST', returns: { m3: 10, y1: 20, y3Annualized: 12, y5Annualized: 9 } },
    ]);

    expect(fast.scoreBreakdown['장기 수익']).toBeGreaterThan(slow.scoreBreakdown['장기 수익']);
  });

  it('keeps strong performers high when one leveraged outlier sets an extreme return', () => {
    const peers = Array.from({ length: 98 }, (_, index) => ({
      ...baseEtf,
      id: `PEER-${index}`,
      returns: { m3: index % 30, y1: index, y3Annualized: null, y5Annualized: null },
    }));
    const scored = scoreEtfs([
      ...peers,
      {
        ...baseEtf,
        id: 'STRONG',
        returns: { m3: 55, y1: 421, y3Annualized: null, y5Annualized: null },
      },
      {
        ...baseEtf,
        id: 'OUTLIER',
        returns: { m3: 1092, y1: 3142, y3Annualized: null, y5Annualized: null },
      },
    ]);
    const strong = scored.find((etf) => etf.id === 'STRONG');

    expect(strong.scoreBreakdown['단기 수익']).toBeGreaterThan(95);
    expect(strong.scoreBreakdown['장기 수익']).toBeGreaterThan(95);
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
