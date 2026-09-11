import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from './search.js';
import { readSearchState, writeSearchParams } from './searchState.js';

describe('search URL state', () => {
  const etfs = [
    { market: '국내', theme: '배당', provider: '삼성', risk: { volatility3yAnnualized: 10 } },
  ];
  it('round-trips search and filters while retaining the analysis target', () => {
    const filters = { ...DEFAULT_FILTERS, market: '국내', theme: '배당' };
    const params = writeSearchParams(new URLSearchParams({ code: '069500' }), '미국 배당', filters);
    expect(params.get('code')).toBe('069500');
    expect(readSearchState(new URLSearchParams(params.toString()), etfs)).toEqual({
      query: '미국 배당',
      filters,
    });
  });
  it('ignores filters no longer present in the snapshot', () => {
    expect(readSearchState(new URLSearchParams('market=invalid&risk=높음'), etfs).filters).toEqual(
      DEFAULT_FILTERS,
    );
  });
  it('removes cleared values without removing other navigation parameters', () => {
    const params = writeSearchParams(
      new URLSearchParams('view=list&q=QQQ&market=미국'),
      '',
      DEFAULT_FILTERS,
    );
    expect(params.toString()).toBe('view=list');
  });
});
