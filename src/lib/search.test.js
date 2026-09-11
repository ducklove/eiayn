import { describe, expect, it } from 'vitest';
import {
  buildSearchIndex,
  filterEtfs,
  getRiskBand,
  searchMatchLabel,
  uniqueOptions,
} from './search.js';

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
      yahooSymbol: '069500.KS',
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
    expect(uniqueOptions(etfs, 'provider', '운용사 전체')).toEqual([
      '운용사 전체',
      '삼성자산운용',
      'Invesco',
    ]);
  });

  it('matches via a precomputed search index identically to direct search', () => {
    const index = buildSearchIndex(etfs);
    const filters = {
      market: '시장 전체',
      theme: '테마 전체',
      provider: '운용사 전체',
      risk: '리스크 전체',
    };

    expect(searchMatchLabel(etfs[0], 'nvidia', index)).toBe('보유종목: NVIDIA Corporation');
    expect(filterEtfs(etfs, 'nvidia', filters, index).map((etf) => etf.id)).toEqual(
      filterEtfs(etfs, 'nvidia', filters).map((etf) => etf.id),
    );
  });

  it.each(['KODEX200', '코덱스200', 'kodex 200', '２００ ＫＯＤＥＸ', '200 kodex'])(
    'finds ETF names despite spacing, order and letter width: %s',
    (query) => {
      expect(filterEtfs(etfs, query).map((etf) => etf.id)).toEqual(['069500']);
    },
  );

  it.each(['삼성 전자', '삼성전자', 'samsung electronics'])(
    'finds Korean and English holding names: %s',
    (query) => {
      expect(filterEtfs(etfs, query).map((etf) => etf.id)).toEqual(['069500']);
    },
  );

  it.each(['나스닥 100', 'NASDAQ100', '엔비디아', 'nvda'])(
    'searches index and holding aliases: %s',
    (query) => {
      expect(filterEtfs(etfs, query).map((etf) => etf.id)).toEqual(['QQQ']);
    },
  );

  it('matches all words across fields without crossing field boundaries', () => {
    expect(filterEtfs(etfs, '미국 테크').map((etf) => etf.id)).toEqual(['QQQ']);
    expect(filterEtfs(etfs, '미국 없는단어')).toEqual([]);
    expect(filterEtfs([{ id: 'AA', name: 'BB' }], 'aabb')).toEqual([]);
  });

  it('ranks exact symbols and names ahead of holding-only matches', () => {
    const candidates = [
      { id: 'OTHER', name: 'Other fund', holdings: [{ name: 'Invesco QQQ Trust' }] },
      ...etfs,
    ];
    expect(filterEtfs(candidates, 'QQQ').map((etf) => etf.id)).toEqual(['QQQ', 'OTHER']);
    expect(filterEtfs(candidates, 'Invesco QQQ Trust')[0].id).toBe('QQQ');
    expect(filterEtfs(etfs, '069500.KS')[0].id).toBe('069500');
  });

  it('applies filters after matching and treats punctuation-only input as empty', () => {
    expect(filterEtfs(etfs, '엔비디아', { market: '국내' })).toEqual([]);
    expect(filterEtfs(etfs, '  ()  ')).toEqual(etfs);
  });

  it('keeps indexed and direct results identical for varied queries', () => {
    const index = buildSearchIndex(etfs);
    for (const query of [
      '코덱스200',
      '미국 테크',
      '삼성 전자',
      '069500.KS',
      '200 kodex',
      '없는단어',
    ]) {
      expect(filterEtfs(etfs, query, {}, index)).toEqual(filterEtfs(etfs, query));
    }
  });
});
