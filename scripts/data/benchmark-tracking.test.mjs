import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_SYMBOLS,
  MIN_TRACKING_OVERLAP_POINTS,
  computeTrackingMetrics,
  resolveBenchmarkSymbol,
  trackingSourceEntry,
} from './benchmark-tracking.mjs';

const DAY_MS = 86_400_000;

function isoDate(time) {
  return new Date(time).toISOString().slice(0, 10);
}

// Daily price series built from exact simple returns: value[i+1] = value[i] * (1 + returns[i]).
function seriesFromReturns(startDate, startValue, returns, stepDays = 1) {
  const start = Date.parse(startDate);
  const points = [{ date: isoDate(start), value: startValue }];
  let value = startValue;
  returns.forEach((dailyReturn, index) => {
    value *= 1 + dailyReturn;
    points.push({ date: isoDate(start + (index + 1) * stepDays * DAY_MS), value });
  });
  return points;
}

function alternating(count, even, odd) {
  return Array.from({ length: count }, (_, index) => (index % 2 === 0 ? even : odd));
}

// 121 joined points -> 120 active returns. Benchmark gains exactly +1% per
// day; the ETF alternates +3% / +2%, so active returns alternate +2% / +1%:
//   mean(active)   = 0.015
//   stddev(active) = 0.005 * sqrt(120 / 119)            (sample, deviations +-0.005)
//   TE  = 0.005 * sqrt(120/119) * sqrt(252) * 100        = 7.97053...  -> 7.97
//   IR  = (0.015 * 252 * 100) / 7.97053...               = 47.42467... -> 47.42
const SPREAD_BENCH_RETURNS = Array(120).fill(0.01);
const SPREAD_ETF_RETURNS = alternating(120, 0.03, 0.02);
const SPREAD_EXPECTED = { trackingError3y: 7.97, informationRatio3y: 47.42 };

describe('BENCHMARK_SYMBOLS', () => {
  it('round-trips every configured benchmark name through the resolver', () => {
    for (const [name, symbol] of Object.entries(BENCHMARK_SYMBOLS)) {
      expect(resolveBenchmarkSymbol(name), name).toBe(symbol);
    }
  });

  it('maps the high-coverage snapshot benchmarks to the expected Yahoo symbols', () => {
    expect(BENCHMARK_SYMBOLS['KRX-EI-KSP200']).toBe('^KS200');
    expect(BENCHMARK_SYMBOLS['SPDJI-EI-SNP500']).toBe('^GSPC');
    expect(BENCHMARK_SYMBOLS['XNAS-EI-NDX']).toBe('^NDX');
    expect(BENCHMARK_SYMBOLS['CSI-EI-300']).toBe('000300.SS');
  });
});

describe('resolveBenchmarkSymbol', () => {
  it('resolves K-ETF vendor index codes', () => {
    expect(resolveBenchmarkSymbol('KRX-EI-KSP200')).toBe('^KS200');
    expect(resolveBenchmarkSymbol('KRX-IX-KSP200tr')).toBe('^KS200');
    expect(resolveBenchmarkSymbol('KRX-EI-KSP')).toBe('^KS11');
    expect(resolveBenchmarkSymbol('HSI-EI-HSCEI')).toBe('^HSCE');
    expect(resolveBenchmarkSymbol('XNSE-EI-NIFTY50')).toBe('^NSEI');
    expect(resolveBenchmarkSymbol('XSHG-EI-STAR50')).toBe('000688.SS');
  });

  it('resolves display names used by the overseas universe', () => {
    expect(resolveBenchmarkSymbol('S&P 500')).toBe('^GSPC');
    expect(resolveBenchmarkSymbol('NASDAQ-100')).toBe('^NDX');
    expect(resolveBenchmarkSymbol('Hang Seng TECH Index')).toBe('^HSTECH');
    expect(resolveBenchmarkSymbol('S&P/ASX 200')).toBe('^AXJO');
    expect(resolveBenchmarkSymbol('EURO STOXX 50')).toBe('^STOXX50E');
    expect(resolveBenchmarkSymbol('DAX')).toBe('^GDAXI');
  });

  it('trims, case-folds, collapses whitespace, and applies NFKC', () => {
    expect(resolveBenchmarkSymbol('  s&p 500  ')).toBe('^GSPC');
    expect(resolveBenchmarkSymbol('krx-ei-ksp200')).toBe('^KS200');
    expect(resolveBenchmarkSymbol('EURO  STOXX\t50')).toBe('^STOXX50E');
    expect(resolveBenchmarkSymbol('nikkei 225')).toBe('^N225');
    // Full-width Latin folds to ASCII under NFKC.
    expect(resolveBenchmarkSymbol('ＤＡＸ')).toBe('^GDAXI');
  });

  it("tolerates a trailing 'Index' / '지수' suffix in either direction", () => {
    expect(resolveBenchmarkSymbol('S&P 500 Index')).toBe('^GSPC');
    expect(resolveBenchmarkSymbol('Nikkei 225 index')).toBe('^N225');
    expect(resolveBenchmarkSymbol('코스피 200 지수')).toBe('^KS200');
    // Map key carries the suffix, query does not.
    expect(resolveBenchmarkSymbol('Hang Seng TECH')).toBe('^HSTECH');
    expect(resolveBenchmarkSymbol('Hang Seng China Enterprises')).toBe('^HSCE');
  });

  it('resolves the Korean KOSPI 200 aliases', () => {
    expect(resolveBenchmarkSymbol('KOSPI 200')).toBe('^KS200');
    expect(resolveBenchmarkSymbol('코스피 200')).toBe('^KS200');
  });

  it('returns null for benchmarks without a workable Yahoo index series', () => {
    expect(resolveBenchmarkSymbol('TOPIX')).toBeNull();
    expect(resolveBenchmarkSymbol('JPX-EI-TOPIX')).toBeNull();
    expect(resolveBenchmarkSymbol('KRX-EI-KSDQ150')).toBeNull();
    expect(resolveBenchmarkSymbol('KRX-IX-KSP200_F')).toBeNull();
    expect(resolveBenchmarkSymbol('KRX-IX-USDKRW')).toBeNull();
    expect(resolveBenchmarkSymbol('Nikkei 225 Leveraged')).toBeNull();
    expect(resolveBenchmarkSymbol('VN30')).toBeNull();
  });

  it('returns null for empty or non-string input', () => {
    expect(resolveBenchmarkSymbol(null)).toBeNull();
    expect(resolveBenchmarkSymbol(undefined)).toBeNull();
    expect(resolveBenchmarkSymbol('')).toBeNull();
    expect(resolveBenchmarkSymbol('   ')).toBeNull();
    expect(resolveBenchmarkSymbol(42)).toBeNull();
    expect(resolveBenchmarkSymbol({})).toBeNull();
  });
});

describe('computeTrackingMetrics', () => {
  it('returns TE 0 and IR null for a perfect tracker (identical series)', () => {
    const returns = alternating(140, 0.012, -0.007);
    const etf = seriesFromReturns('2023-06-01', 100, returns);
    const benchmark = seriesFromReturns('2023-06-01', 250, returns);
    expect(computeTrackingMetrics(etf, benchmark)).toEqual({
      trackingError3y: 0,
      informationRatio3y: null,
    });
  });

  it('computes the hand-derived TE/IR for a constant-return-spread tracker', () => {
    const etf = seriesFromReturns('2024-01-01', 100, SPREAD_ETF_RETURNS);
    const benchmark = seriesFromReturns('2024-01-01', 100, SPREAD_BENCH_RETURNS);
    expect(computeTrackingMetrics(etf, benchmark)).toEqual(SPREAD_EXPECTED);
  });

  it('rounds to 2 decimals and reports IR ~0 for a zero-mean active spread', () => {
    // Active returns alternate +-2% with mean 0:
    //   TE = 0.02 * sqrt(120/119) * sqrt(252) * 100 = 31.88213... -> 31.88
    const etf = seriesFromReturns('2024-01-01', 100, alternating(120, 0.03, -0.01));
    const benchmark = seriesFromReturns('2024-01-01', 100, Array(120).fill(0.01));
    const result = computeTrackingMetrics(etf, benchmark);
    expect(result.trackingError3y).toBe(31.88);
    expect(result.informationRatio3y).not.toBeNull();
    expect(result.informationRatio3y).toBeCloseTo(0, 10);
  });

  it('suppresses IR when the published TE rounds to zero (constant active return)', () => {
    // ETF return = benchmark return + 0.1% every day: stddev(active) is float
    // noise (~1e-16), so TE publishes as 0.00 and a mean/TE ratio would be a
    // nonsense astronomical number. The metrics must be { 0, null }.
    const benchmark = seriesFromReturns('2024-01-01', 100, alternating(120, 0.01, -0.01));
    const etf = seriesFromReturns('2024-01-01', 100, alternating(120, 0.011, -0.009));
    expect(computeTrackingMetrics(etf, benchmark)).toEqual({
      trackingError3y: 0,
      informationRatio3y: null,
    });
  });

  it('inner-joins by date, ignoring points present in only one series', () => {
    // Shared backbone on every second day; junk points (valid prices, so only
    // the join can exclude them) on dates unique to each side.
    const etf = seriesFromReturns('2024-01-01', 100, SPREAD_ETF_RETURNS, 2);
    const benchmark = seriesFromReturns('2024-01-01', 100, SPREAD_BENCH_RETURNS, 2);
    const start = Date.parse('2024-01-01');
    const etfOnly = Array.from({ length: 30 }, (_, index) => ({
      date: isoDate(start + (2 * index + 1) * DAY_MS),
      value: index % 2 === 0 ? 99999 : 0.01,
    }));
    const benchmarkOnly = Array.from({ length: 25 }, (_, index) => ({
      date: isoDate(start + (2 * index + 61) * DAY_MS),
      value: index % 2 === 0 ? 0.5 : 12345,
    }));
    expect(computeTrackingMetrics([...etf, ...etfOnly], [...benchmark, ...benchmarkOnly])).toEqual(
      SPREAD_EXPECTED,
    );
  });

  it(`requires at least ${MIN_TRACKING_OVERLAP_POINTS} joined points`, () => {
    const returns = alternating(MIN_TRACKING_OVERLAP_POINTS - 1, 0.01, -0.01);
    const series = seriesFromReturns('2024-01-01', 100, returns);
    expect(series).toHaveLength(MIN_TRACKING_OVERLAP_POINTS);

    // Exactly at the threshold: computed (identical series -> TE 0).
    expect(computeTrackingMetrics(series, [...series])).toEqual({
      trackingError3y: 0,
      informationRatio3y: null,
    });
    // One point below: nulls.
    expect(computeTrackingMetrics(series.slice(1), [...series])).toEqual({
      trackingError3y: null,
      informationRatio3y: null,
    });
  });

  it('returns nulls when long series share fewer than the minimum overlap', () => {
    const returns = alternating(200, 0.01, -0.005);
    const etf = seriesFromReturns('2024-01-01', 100, returns);
    const benchmark = seriesFromReturns('2024-01-01', 100, returns).map((point, index) => ({
      // Shift all but the first MIN-1 dates far away so only 119 dates join.
      date:
        index < MIN_TRACKING_OVERLAP_POINTS - 1
          ? point.date
          : isoDate(Date.parse(point.date) + 365 * DAY_MS),
      value: point.value,
    }));
    expect(computeTrackingMetrics(etf, benchmark)).toEqual({
      trackingError3y: null,
      informationRatio3y: null,
    });
  });

  it('tolerates unsorted input, drops dirty points, and keeps the last duplicate', () => {
    const etf = seriesFromReturns('2024-01-01', 100, SPREAD_ETF_RETURNS);
    const benchmark = seriesFromReturns('2024-01-01', 100, SPREAD_BENCH_RETURNS);
    const dirtyEtf = [
      // Valid-looking duplicate listed before the genuine point: last wins.
      { date: etf[10].date, value: 999999 },
      ...[...etf].reverse(),
      // Invalid duplicates after the genuine points must not clobber them.
      { date: etf[20].date, value: Number.NaN },
      { date: etf[30].date, value: 0 },
      { date: etf[40].date, value: -5 },
      { date: etf[50].date, value: Infinity },
      { date: etf[60].date, value: null },
      // Garbage rows.
      { value: 123 },
      { date: '', value: 123 },
      { date: 'not-a-date', value: 123 },
      null,
      undefined,
    ];
    const dirtyBenchmark = [
      { date: benchmark[5].date, value: 0.0001 },
      ...[...benchmark].reverse(),
    ];
    expect(computeTrackingMetrics(dirtyEtf, dirtyBenchmark)).toEqual(SPREAD_EXPECTED);
  });

  it('returns nulls for missing or empty series', () => {
    const nulls = { trackingError3y: null, informationRatio3y: null };
    expect(computeTrackingMetrics(null, undefined)).toEqual(nulls);
    expect(computeTrackingMetrics([], [])).toEqual(nulls);
    expect(computeTrackingMetrics([{ date: '2024-01-01', value: 100 }], [])).toEqual(nulls);
  });
});

describe('trackingSourceEntry', () => {
  it('builds the dataQuality attribution entry for a benchmark symbol', () => {
    expect(trackingSourceEntry('^GSPC')).toEqual({
      name: 'Yahoo Finance chart (benchmark)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/^GSPC',
      fields: ['risk.trackingError3y', 'risk.informationRatio3y'],
    });
    expect(trackingSourceEntry('000300.SS').url).toBe(
      'https://query1.finance.yahoo.com/v8/finance/chart/000300.SS',
    );
  });
});
