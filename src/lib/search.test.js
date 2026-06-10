import { describe, expect, it } from 'vitest';
import { buildSearchIndex, filterEtfs, getRiskBand, uniqueOptions } from './search.js';

describe('search utilities', () => {
  const etfs = [
    {
      id: 'QQQ',
      ticker: 'QQQ',
      aliases: ['QQQ.O'],
      name: 'Invesco QQQ Trust',
      shortName: 'QQQ',
      provider: 'Invesco',
      market: '미국',
      theme: '테크',
      category: 'NASDAQ-100',
      risk: { volatility3yAnnualized: 19 },
      holdings: [{ name: 'NVIDIA Corporation', ticker: 'NVDA', weight: 8.6 }],
    },
    {
      id: '069500',
      ticker: '069500',
      name: 'KODEX 200',
      shortName: 'KODEX 200',
      provider: '삼성자산운용',
      market: '국내',
      theme: '대표지수',
      category: 'KOSPI 200',
      risk: { volatility3yAnnualized: 28 },
      holdings: [{ name: 'Samsung Electronics', ticker: '005930', weight: 30 }],
    },
  ];

  it('searches holdings as well as ETF metadata', () => {
    const result = filterEtfs(etfs, 'nvidia', {
      market: '시장 전체',
      theme: '테마 전체',
      provider: '운용사 전체',
      risk: '리스크 전체',
    });

    expect(result.map((etf) => etf.id)).toEqual(['QQQ']);
  });

  it('searches ticker aliases', () => {
    const result = filterEtfs(etfs, 'qqq.o', {
      market: '시장 전체',
      theme: '테마 전체',
      provider: '운용사 전체',
      risk: '리스크 전체',
    });

    expect(result.map((etf) => etf.id)).toEqual(['QQQ']);
  });

  it('filters by market and risk band', () => {
    const result = filterEtfs(etfs, '', {
      market: '국내',
      theme: '테마 전체',
      provider: '운용사 전체',
      risk: '높음',
    });

    expect(result.map((etf) => etf.id)).toEqual(['069500']);
    expect(getRiskBand(etfs[0])).toBe('보통');
  });

  it('builds dynamic filter options', () => {
    expect(uniqueOptions(etfs, 'provider', '운용사 전체')).toEqual(['운용사 전체', '삼성자산운용', 'Invesco']);
  });

  it('matches via a precomputed search index identically to direct search', () => {
    const index = buildSearchIndex(etfs);
    const filters = {
      market: '시장 전체',
      theme: '테마 전체',
      provider: '운용사 전체',
      risk: '리스크 전체',
    };

    expect(index.get('QQQ')).toContain('nvidia');
    expect(filterEtfs(etfs, 'nvidia', filters, index).map((etf) => etf.id))
      .toEqual(filterEtfs(etfs, 'nvidia', filters).map((etf) => etf.id));
  });
});
