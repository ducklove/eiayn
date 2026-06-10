import { describe, expect, it } from 'vitest';
import { sortEtfs } from './sort.js';

describe('sortEtfs', () => {
  const etfs = [
    { id: 'A', name: '나 ETF', aiynScore: 60, returns: { y1: 5 } },
    { id: 'B', name: '가 ETF', aiynScore: 80, returns: { y1: null } },
    { id: 'C', name: '다 ETF', aiynScore: null, returns: { y1: 12 } },
  ];

  it('sorts numbers descending by default with nulls last', () => {
    expect(sortEtfs(etfs, 'aiynScore').map((etf) => etf.id)).toEqual(['B', 'A', 'C']);
  });

  it('sorts ascending while keeping nulls last', () => {
    expect(sortEtfs(etfs, 'aiynScore', 'asc').map((etf) => etf.id)).toEqual(['A', 'B', 'C']);
    expect(sortEtfs(etfs, 'returns.y1', 'asc').map((etf) => etf.id)).toEqual(['A', 'C', 'B']);
  });

  it('resolves nested paths', () => {
    expect(sortEtfs(etfs, 'returns.y1', 'desc').map((etf) => etf.id)).toEqual(['C', 'A', 'B']);
  });

  it('sorts Korean strings with locale comparison and does not mutate input', () => {
    const sorted = sortEtfs(etfs, 'name', 'asc');
    expect(sorted.map((etf) => etf.name)).toEqual(['가 ETF', '나 ETF', '다 ETF']);
    expect(etfs[0].id).toBe('A');
  });
});
