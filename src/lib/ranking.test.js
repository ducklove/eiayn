import { describe, expect, it } from 'vitest';
import { rankEtfsByScore } from './ranking.js';

function etf(id, aiynScore, overrides = {}) {
  return { id, aiynScore, scoreCoverage: 1, aum: 1000, ...overrides };
}

describe('rankEtfsByScore', () => {
  it('orders by AIYN score descending', () => {
    const ranked = rankEtfsByScore([etf('A', 50), etf('B', 90), etf('C', 70)]);
    expect(ranked.map((item) => item.id)).toEqual(['B', 'C', 'A']);
  });

  it('excludes ETFs without a finite score instead of ranking them as zero', () => {
    const ranked = rankEtfsByScore([
      etf('A', 50),
      etf('B', null),
      etf('C', undefined),
      etf('D', Number.NaN),
    ]);
    expect(ranked.map((item) => item.id)).toEqual(['A']);
  });

  it('breaks score ties by coverage, then AUM, then id', () => {
    const ranked = rankEtfsByScore([
      etf('D', 80, { scoreCoverage: 0.8, aum: 100 }),
      etf('C', 80, { scoreCoverage: 1, aum: 100 }),
      etf('B', 80, { scoreCoverage: 1, aum: 500 }),
      etf('A2', 80, { scoreCoverage: 1, aum: 500 }),
      etf('E', 80, { scoreCoverage: 1, aum: null }),
    ]);
    expect(ranked.map((item) => item.id)).toEqual(['A2', 'B', 'C', 'E', 'D']);
  });

  it('places null coverage after numeric coverage on equal scores', () => {
    const ranked = rankEtfsByScore([
      etf('A', 80, { scoreCoverage: null }),
      etf('B', 80, { scoreCoverage: 0.5 }),
    ]);
    expect(ranked.map((item) => item.id)).toEqual(['B', 'A']);
  });

  it('applies the limit after sorting', () => {
    const ranked = rankEtfsByScore([etf('A', 10), etf('B', 30), etf('C', 20)], { limit: 2 });
    expect(ranked.map((item) => item.id)).toEqual(['B', 'C']);
  });

  it('does not mutate the input array', () => {
    const input = [etf('A', 10), etf('B', 30)];
    rankEtfsByScore(input);
    expect(input.map((item) => item.id)).toEqual(['A', 'B']);
  });
});
