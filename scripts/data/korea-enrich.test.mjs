import { describe, expect, it } from 'vitest';
import {
  calculateAnnualizedReturn,
  calculateAnnualizedVolatility,
  calculateMaxDrawdown,
  calculatePeriodReturn,
  calculateSharpeRatio,
  normalizeSparkline,
  sliceSeriesFrom,
} from '../../src/lib/metrics.js';
import { roundNullable, trailingDividendYield } from './yahoo.mjs';
import {
  applyKoreanYahooEnrichment,
  enrichKoreanEtfsWithYahoo,
  KOREA_YAHOO_SOURCE_NAME,
  koreanYahooSymbol,
  selectKoreanYahooTargets,
} from './korea-enrich.mjs';

const CHART_URL =
  'https://query1.finance.yahoo.com/v8/finance/chart/069500.KS?range=5y&interval=1d';

function buildSeries() {
  const points = [];
  let value = 100;
  for (let index = 0; index <= 72; index += 1) {
    const date = new Date(Date.UTC(2020, index, 2)).toISOString().slice(0, 10);
    points.push({ date, close: value, adjustedClose: value, volume: 1_000_000 });
    value *= index % 12 === 6 ? 0.95 : 1.02;
  }
  return points;
}

function mappedSeries(points) {
  return points.map((point) => ({ date: point.date, value: point.adjustedClose ?? point.close }));
}

function makeChart(overrides = {}) {
  return {
    url: CHART_URL,
    meta: { currency: 'KRW', symbol: '069500.KS' },
    series: buildSeries(),
    dividends: [],
    quoteAsOf: '2026-06-09T07:00:00.000Z',
    ...overrides,
  };
}

function makeKoreanEtf(overrides = {}) {
  return {
    id: '069500',
    ticker: '069500',
    yahooSymbol: '069500',
    name: 'KODEX 200',
    shortName: 'KODEX 200',
    provider: '삼성자산운용',
    market: '국내',
    assetClass: '주식',
    theme: '시장대표',
    category: '국내 시장대표',
    benchmarkIndex: 'KOSPI 200',
    currency: 'KRW',
    price: 36500,
    changePercent: 0.42,
    expenseRatio: 0.15,
    aum: 6_100_000_000_000,
    dividendYield: 1.8,
    inceptionDate: '2002-10-11',
    nav: null,
    returns: { m3: 3.1, y1: 12.4, y3Annualized: null, y5Annualized: null },
    risk: {
      volatility3yAnnualized: null,
      maxDrawdown3y: null,
      sharpe3y: null,
      trackingError3y: null,
      informationRatio3y: null,
    },
    holdings: [],
    sparkline: [36000, 36500],
    liquidity: {
      volume: 5_000_000,
      tradingValue: 180_000_000_000,
      marketCap: 6_100_000_000_000,
      sourceRank: 1,
    },
    dataQuality: {
      quoteAsOf: '2026-06-05T06:00:00.000Z',
      profileAsOf: '2026-06-05T00:00:00.000Z',
      holdingsAsOf: null,
      sources: [
        {
          name: 'K-ETF active ETF lineup',
          url: 'https://anchor.k-etf.com/api/instrument/instruments/',
          fields: ['name'],
        },
      ],
      missingFields: [],
    },
    ...overrides,
  };
}

describe('applyKoreanYahooEnrichment', () => {
  it('fills null long-horizon fields while keeping K-ETF values', () => {
    const etf = makeKoreanEtf();
    const chart = makeChart({
      dividends: [{ amount: 700, date: Math.floor(Date.now() / 1000) - 40 * 86_400 }],
    });
    const series = mappedSeries(chart.series);
    const series3y = sliceSeriesFrom(series, { years: 3 });

    const result = applyKoreanYahooEnrichment(etf, chart);

    expect(result.returns.m3).toBe(3.1);
    expect(result.returns.y1).toBe(12.4);
    expect(result.dividendYield).toBe(1.8);

    expect(result.returns.y3Annualized).toBe(roundNullable(calculateAnnualizedReturn(series, 3)));
    expect(result.returns.y5Annualized).toBe(roundNullable(calculateAnnualizedReturn(series, 5)));
    expect(result.returns.y3Annualized).not.toBeNull();
    expect(result.returns.y5Annualized).not.toBeNull();

    expect(result.risk.volatility3yAnnualized).toBe(
      roundNullable(calculateAnnualizedVolatility(series3y)),
    );
    expect(result.risk.maxDrawdown3y).toBe(roundNullable(calculateMaxDrawdown(series3y)));
    expect(result.risk.sharpe3y).toBe(roundNullable(calculateSharpeRatio(series3y)));
    expect(result.risk.volatility3yAnnualized).not.toBeNull();
    expect(result.risk.maxDrawdown3y).not.toBeNull();
    expect(result.risk.sharpe3y).not.toBeNull();
    expect(result.risk.trackingError3y).toBeNull();
    expect(result.risk.informationRatio3y).toBeNull();
  });

  it('sets the KRX yahooSymbol and appends one source entry listing only filled fields', () => {
    const etf = makeKoreanEtf();
    const result = applyKoreanYahooEnrichment(etf, makeChart());

    expect(result.yahooSymbol).toBe('069500.KS');
    expect(result.dataQuality.sources).toHaveLength(2);
    expect(result.dataQuality.sources.at(-1)).toEqual({
      name: KOREA_YAHOO_SOURCE_NAME,
      url: CHART_URL,
      fields: [
        'returns.y3Annualized',
        'returns.y5Annualized',
        'risk.volatility3yAnnualized',
        'risk.maxDrawdown3y',
        'risk.sharpe3y',
      ],
    });
    expect(result.dataQuality.quoteAsOf).toBe(etf.dataQuality.quoteAsOf);
    expect(result.dataQuality.profileAsOf).toBe(etf.dataQuality.profileAsOf);
    expect(result.dataQuality.holdingsAsOf).toBe(etf.dataQuality.holdingsAsOf);
    expect(result.dataQuality.missingFields).toEqual(etf.dataQuality.missingFields);
  });

  it('fills returns.m3, returns.y1, and dividendYield only as fallbacks', () => {
    const etf = makeKoreanEtf({
      returns: { m3: null, y1: null, y3Annualized: null, y5Annualized: null },
      dividendYield: null,
    });
    const dividends = [{ amount: 500, date: Math.floor(Date.now() / 1000) - 30 * 86_400 }];
    const chart = makeChart({ dividends });
    const series = mappedSeries(chart.series);

    const result = applyKoreanYahooEnrichment(etf, chart);

    expect(result.returns.m3).toBe(roundNullable(calculatePeriodReturn(series, { months: 3 })));
    expect(result.returns.y1).toBe(roundNullable(calculatePeriodReturn(series, { years: 1 })));
    expect(result.returns.m3).not.toBeNull();
    expect(result.returns.y1).not.toBeNull();
    expect(result.dividendYield).toBe(trailingDividendYield(dividends, etf.price));
    expect(result.dividendYield).toBeCloseTo(1.37, 10);
    expect(result.dataQuality.sources.at(-1).fields).toEqual([
      'returns.m3',
      'returns.y1',
      'returns.y3Annualized',
      'returns.y5Annualized',
      'risk.volatility3yAnnualized',
      'risk.maxDrawdown3y',
      'risk.sharpe3y',
      'dividendYield',
    ]);
  });

  it('keeps an existing sparkline untouched', () => {
    const etf = makeKoreanEtf();
    const result = applyKoreanYahooEnrichment(etf, makeChart());
    expect(result.sparkline).toBe(etf.sparkline);
    expect(result.dataQuality.sources.at(-1).fields).not.toContain('sparkline');
  });

  it('fills an empty sparkline from the Yahoo series preferring adjustedClose', () => {
    const etf = makeKoreanEtf({
      returns: { m3: 1, y1: 2, y3Annualized: 3, y5Annualized: 4 },
      risk: {
        volatility3yAnnualized: 10,
        maxDrawdown3y: -5,
        sharpe3y: 0.5,
        trackingError3y: null,
        informationRatio3y: null,
      },
      dividendYield: 1.8,
      sparkline: [],
    });
    const chart = makeChart({
      series: [
        { date: '2026-01-01', close: 200, adjustedClose: 100 },
        { date: '2026-01-02', close: 220, adjustedClose: 110 },
      ],
    });

    const result = applyKoreanYahooEnrichment(etf, chart);

    expect(result.sparkline).toEqual(normalizeSparkline(mappedSeries(chart.series)));
    expect(result.sparkline).toEqual([100, 110]);
    expect(result.dataQuality.sources.at(-1).fields).toEqual(['sparkline']);
    expect(result.yahooSymbol).toBe('069500.KS');
  });

  it('falls back to close when adjustedClose is missing', () => {
    const etf = makeKoreanEtf({
      returns: { m3: 1, y1: 2, y3Annualized: 3, y5Annualized: 4 },
      risk: {
        volatility3yAnnualized: 10,
        maxDrawdown3y: -5,
        sharpe3y: 0.5,
        trackingError3y: null,
        informationRatio3y: null,
      },
      sparkline: [],
    });
    const chart = makeChart({
      series: [
        { date: '2026-01-01', close: 100, adjustedClose: null },
        { date: '2026-01-02', close: 102, adjustedClose: null },
      ],
    });
    expect(applyKoreanYahooEnrichment(etf, chart).sparkline).toEqual([100, 102]);
  });

  it('returns the input object unchanged when there is nothing to fill', () => {
    const etf = makeKoreanEtf({
      returns: { m3: 1, y1: 2, y3Annualized: 3, y5Annualized: 4 },
      risk: {
        volatility3yAnnualized: 10,
        maxDrawdown3y: -5,
        sharpe3y: 0.5,
        trackingError3y: null,
        informationRatio3y: null,
      },
      dividendYield: 1.8,
    });
    const result = applyKoreanYahooEnrichment(etf, makeChart());
    expect(result).toBe(etf);
    expect(result.yahooSymbol).toBe('069500');
    expect(result.dataQuality.sources).toHaveLength(1);
  });

  it('returns the input object unchanged for missing or empty charts', () => {
    const etf = makeKoreanEtf();
    expect(applyKoreanYahooEnrichment(etf, null)).toBe(etf);
    expect(applyKoreanYahooEnrichment(etf, undefined)).toBe(etf);
    expect(applyKoreanYahooEnrichment(etf, makeChart({ series: [], dividends: [] }))).toBe(etf);
  });

  it('does not mutate the input ETF', () => {
    const etf = makeKoreanEtf({
      returns: { m3: null, y1: null, y3Annualized: null, y5Annualized: null },
      dividendYield: null,
      sparkline: [],
    });
    const snapshot = structuredClone(etf);
    const result = applyKoreanYahooEnrichment(etf, makeChart());
    expect(result).not.toBe(etf);
    expect(etf).toEqual(snapshot);
  });
});

describe('selectKoreanYahooTargets', () => {
  const etfs = [
    makeKoreanEtf({ id: 'A', ticker: 'A', liquidity: { tradingValue: 100 } }),
    makeKoreanEtf({ id: 'B', ticker: 'B', liquidity: { tradingValue: 900 } }),
    makeKoreanEtf({ id: 'C', ticker: 'C', liquidity: { tradingValue: null } }),
    makeKoreanEtf({ id: 'D', ticker: 'D', liquidity: { tradingValue: 500 } }),
  ];

  it('returns all ETFs in original order when no limit is set', () => {
    expect(selectKoreanYahooTargets(etfs, null).map((etf) => etf.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(selectKoreanYahooTargets(etfs, undefined)).toHaveLength(4);
  });

  it('returns the top-N by tradingValue descending when a limit is set', () => {
    expect(selectKoreanYahooTargets(etfs, 2).map((etf) => etf.id)).toEqual(['B', 'D']);
    expect(selectKoreanYahooTargets(etfs, 3).map((etf) => etf.id)).toEqual(['B', 'D', 'A']);
  });

  it('supports a zero limit to disable enrichment', () => {
    expect(selectKoreanYahooTargets(etfs, 0)).toEqual([]);
  });
});

describe('enrichKoreanEtfsWithYahoo', () => {
  const nullReturns = { m3: null, y1: null, y3Annualized: null, y5Annualized: null };

  function makeUniverse() {
    return [
      makeKoreanEtf({
        id: '069500',
        ticker: '069500',
        returns: { ...nullReturns },
        liquidity: { tradingValue: 900 },
      }),
      makeKoreanEtf({
        id: '360750',
        ticker: '360750',
        returns: { ...nullReturns },
        liquidity: { tradingValue: 500 },
      }),
      makeKoreanEtf({
        id: '458730',
        ticker: '458730',
        returns: { ...nullReturns },
        liquidity: { tradingValue: 100 },
      }),
    ];
  }

  it('keeps every ETF unchanged and never throws when Yahoo is unavailable', async () => {
    const etfs = makeUniverse();
    const logs = [];
    const result = await enrichKoreanEtfsWithYahoo(etfs, {
      fetchChart: async () => {
        throw new Error('403 Forbidden');
      },
      log: (message) => logs.push(message),
    });

    expect(result).toHaveLength(3);
    result.forEach((etf, index) => expect(etf).toBe(etfs[index]));
    expect(logs.at(-1)).toBe('[data:update] Korea Yahoo enrichment: 0/3 enriched (3 unavailable)');
  });

  it('enriches available charts and leaves failures unchanged', async () => {
    const etfs = makeUniverse();
    const logs = [];
    const result = await enrichKoreanEtfsWithYahoo(etfs, {
      fetchChart: async (symbol) => {
        if (symbol === '360750.KS') return makeChart();
        throw new Error('403 Forbidden');
      },
      log: (message) => logs.push(message),
    });

    expect(result.map((etf) => etf.id)).toEqual(['069500', '360750', '458730']);
    expect(result[0]).toBe(etfs[0]);
    expect(result[2]).toBe(etfs[2]);
    expect(result[1]).not.toBe(etfs[1]);
    expect(result[1].yahooSymbol).toBe('360750.KS');
    expect(result[1].returns.y3Annualized).not.toBeNull();
    expect(logs.at(-1)).toBe('[data:update] Korea Yahoo enrichment: 1/3 enriched (2 unavailable)');
  });

  it('requests `${code}.KS` symbols and honors the liquidity limit', async () => {
    const etfs = makeUniverse();
    const requested = [];
    const result = await enrichKoreanEtfsWithYahoo(etfs, {
      limit: 1,
      fetchChart: async (symbol) => {
        requested.push(symbol);
        return makeChart();
      },
      log: () => {},
    });

    expect(requested).toEqual(['069500.KS']);
    expect(result[0].yahooSymbol).toBe('069500.KS');
    expect(result[1]).toBe(etfs[1]);
    expect(result[2]).toBe(etfs[2]);
  });

  it('builds KRX symbols from tickers', () => {
    expect(koreanYahooSymbol('069500')).toBe('069500.KS');
  });
});
