import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from './search.js';
import { carryShellParams, readEmbed, readSearchState, writeSearchParams } from './searchState.js';

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
  it('writes the ETF theme filter as etf_theme so ?theme stays the visual theme', () => {
    const filters = { ...DEFAULT_FILTERS, theme: '배당' };
    const params = writeSearchParams(new URLSearchParams('theme=dark&code=069500'), '', filters);
    expect(params.get('etf_theme')).toBe('배당');
    expect(params.get('theme')).toBe('dark');
    expect(readSearchState(params, etfs).filters.theme).toBe('배당');
  });
  it('never reads ?theme=light|dark as an ETF theme filter', () => {
    const themed = [...etfs, { market: '국내', theme: 'dark' }];
    expect(readSearchState(new URLSearchParams('theme=dark'), themed).filters.theme).toBe(
      DEFAULT_FILTERS.theme,
    );
  });
  it('maps a legacy ?theme=<category> link to the filter and rewrites it to etf_theme', () => {
    const params = new URLSearchParams('theme=배당&view=list');
    const state = readSearchState(params, etfs);
    expect(state.filters.theme).toBe('배당');
    writeSearchParams(params, state.query, state.filters);
    expect(params.toString()).toBe(`view=list&etf_theme=${encodeURIComponent('배당')}`);
  });
  it('prefers etf_theme over a legacy theme value', () => {
    const both = [...etfs, { market: '미국', theme: '성장' }];
    expect(
      readSearchState(new URLSearchParams('etf_theme=성장&theme=배당'), both).filters.theme,
    ).toBe('성장');
  });
  it('carries the visual theme and embed parameters across rebuilt navigation URLs', () => {
    const next = carryShellParams(
      new URLSearchParams('view=list'),
      new URLSearchParams('theme=dark&embed=1&vc-shell=0&q=x'),
    );
    expect(next.toString()).toBe('view=list&theme=dark&embed=1&vc-shell=0');
    const legacy = carryShellParams(new URLSearchParams(), new URLSearchParams('theme=배당'));
    expect(legacy.toString()).toBe('');
  });
  it('carries ?embed=<view> as a bare flag so the rebuilt URL keeps its own view', () => {
    const next = carryShellParams(
      new URLSearchParams('compare=069500&active=069500'),
      new URLSearchParams('embed=ranking&view=ranking'),
    );
    expect(next.get('embed')).toBe('1');
    expect(readEmbed(next)).toEqual({ view: null });
    expect(
      carryShellParams(new URLSearchParams(), new URLSearchParams('embed=true')).get('embed'),
    ).toBe('true');
  });
  it('parses ?embed like the ecosystem shell (0/false disable, value may name a view)', () => {
    expect(readEmbed(new URLSearchParams(''))).toBeNull();
    expect(readEmbed(new URLSearchParams('embed=0'))).toBeNull();
    expect(readEmbed(new URLSearchParams('embed=false'))).toBeNull();
    expect(readEmbed(new URLSearchParams('embed'))).toEqual({ view: null });
    expect(readEmbed(new URLSearchParams('embed=1'))).toEqual({ view: null });
    expect(readEmbed(new URLSearchParams('embed=Ranking'))).toEqual({ view: 'ranking' });
  });
});
