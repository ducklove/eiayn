import { describe, expect, it } from 'vitest';
import { KETF_SOURCES, normalizeKoreanHoldings } from './k-etf.mjs';

const URL = 'https://anchor.k-etf.com/api/instrument/holdings/?code=069500&language=ko';

describe('normalizeKoreanHoldings', () => {
  it('normalizes holdings and formats asOf as UTC midnight', () => {
    const result = normalizeKoreanHoldings(
      {
        asof: '2026-06-05',
        holdings: [
          { name: '삼성전자', holding_ticker: '005930', weight: '22.5' },
          { name: 'SK하이닉스', holding_ticker: '000660', weight: 11.25 },
        ],
      },
      URL,
    );

    expect(result.holdings).toEqual([
      { name: '삼성전자', ticker: '005930', weight: 22.5 },
      { name: 'SK하이닉스', ticker: '000660', weight: 11.25 },
    ]);
    expect(result.asOf).toBe('2026-06-05T00:00:00.000Z');
    expect(result.source).toEqual({
      name: KETF_SOURCES.holdings.name,
      url: URL,
      fields: ['holdings'],
    });
  });

  it('falls back to holding_name when name is missing', () => {
    const result = normalizeKoreanHoldings(
      {
        holdings: [{ holding_name: '  현대차  보통주 ', holding_ticker: '005380', weight: 5 }],
      },
      URL,
    );
    expect(result.holdings).toEqual([{ name: '현대차 보통주', ticker: '005380', weight: 5 }]);
  });

  it('falls back through holding_ticker, ticker, then holding_isin', () => {
    const result = normalizeKoreanHoldings(
      {
        holdings: [
          {
            name: 'A',
            holding_ticker: '005930',
            ticker: 'IGNORED',
            holding_isin: 'KR-IGNORED',
            weight: 1,
          },
          { name: 'B', ticker: '000660', holding_isin: 'KR-IGNORED', weight: 1 },
          { name: 'C', holding_isin: 'KR7035420009', weight: 1 },
          { name: 'D', weight: 1 },
        ],
      },
      URL,
    );
    expect(result.holdings.map((holding) => holding.ticker)).toEqual([
      '005930',
      '000660',
      'KR7035420009',
      null,
    ]);
  });

  it('drops rows without a usable name or numeric weight', () => {
    const result = normalizeKoreanHoldings(
      {
        holdings: [
          { name: '', weight: 3 },
          { weight: 3 },
          { name: '원화예금', weight: null },
          { name: '국고채권', weight: 'n/a-ish' },
          { name: 'KODEX 200 구성', weight: 0 },
        ],
      },
      URL,
    );
    expect(result.holdings).toEqual([{ name: 'KODEX 200 구성', ticker: null, weight: 0 }]);
  });

  it('keeps rows beyond the top 10 and caps holdings at 25', () => {
    const result = normalizeKoreanHoldings(
      {
        holdings: Array.from({ length: 30 }, (_, index) => ({
          name: `종목 ${index + 1}`,
          weight: 30 - index,
        })),
      },
      URL,
    );
    expect(result.holdings).toHaveLength(25);
    expect(result.holdings[10]).toEqual({ name: '종목 11', ticker: null, weight: 20 });
    expect(result.holdings.at(-1)).toEqual({ name: '종목 25', ticker: null, weight: 6 });
  });

  it('handles a missing payload without throwing', () => {
    const result = normalizeKoreanHoldings(null, URL);
    expect(result.holdings).toEqual([]);
    expect(result.asOf).toBeNull();
    expect(result.source.url).toBe(URL);
  });
});
