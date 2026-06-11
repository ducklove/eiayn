import { describe, expect, it } from 'vitest';
import { buildRankingsPayload } from './build-rankings.mjs';

function etf(id, aiynScore, overrides = {}) {
  return {
    id,
    ticker: id,
    name: `${id} ETF`,
    shortName: id,
    market: '국내',
    currency: 'KRW',
    provider: '운용사',
    aiynScore,
    scoreCoverage: 1,
    expenseRatio: 0.2,
    dividendYield: 1.1,
    aum: 1000,
    returns: { y1: 5.5 },
    ...overrides,
  };
}

const snapshot = (etfs) => ({ generatedAt: '2026-06-11T00:00:00.000Z', etfs });

describe('buildRankingsPayload', () => {
  it('ranks by AIYN score descending with 1-based ranks and deep links', () => {
    const payload = buildRankingsPayload(snapshot([etf('A', 50), etf('B', 90), etf('C', null)]), {
      baseUrl: 'https://example.test/eiayn/',
    });

    expect(payload.generatedAt).toBe('2026-06-11T00:00:00.000Z');
    expect(payload.universeSize).toBe(3);
    expect(payload.count).toBe(2);
    expect(payload.etfs.map((item) => [item.rank, item.id])).toEqual([
      [1, 'B'],
      [2, 'A'],
    ]);
    expect(payload.etfs[0].link).toBe('https://example.test/eiayn/?code=B');
  });

  it('keeps missing metrics null and URL-encodes ids in links', () => {
    const payload = buildRankingsPayload(
      snapshot([
        etf('3188.HK', 70, {
          provider: undefined,
          expenseRatio: null,
          dividendYield: undefined,
          returns: undefined,
          aum: undefined,
        }),
      ]),
      { baseUrl: 'https://example.test/' },
    );

    const entry = payload.etfs[0];
    expect(entry.provider).toBeNull();
    expect(entry.expenseRatio).toBeNull();
    expect(entry.dividendYield).toBeNull();
    expect(entry.return1y).toBeNull();
    expect(entry.aum).toBeNull();
    expect(entry.link).toBe('https://example.test/?code=3188.HK');
  });

  it('truncates to the limit', () => {
    const payload = buildRankingsPayload(snapshot([etf('A', 10), etf('B', 30), etf('C', 20)]), {
      limit: 2,
    });
    expect(payload.count).toBe(2);
    expect(payload.etfs.map((item) => item.id)).toEqual(['B', 'C']);
  });

  it('rejects snapshots without an etfs array or generatedAt', () => {
    expect(() => buildRankingsPayload({ generatedAt: 'x' })).toThrow(TypeError);
    expect(() => buildRankingsPayload({ etfs: [] })).toThrow(TypeError);
  });
});
