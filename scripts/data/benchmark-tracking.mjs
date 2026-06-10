// Benchmark tracking metrics (risk.trackingError3y / risk.informationRatio3y).
//
// The snapshot's `benchmarkIndex` strings come from two places: the K-ETF
// compare API emits vendor index codes (e.g. 'KRX-EI-KSP200', 'SPDJI-EI-SNP500')
// and scripts/data/universe.mjs hardcodes display names for overseas listings
// (e.g. 'S&P 500', 'Hang Seng TECH Index'). This module maps the strings that
// have a liquid public Yahoo Finance index series to a chart symbol and
// computes tracking error / information ratio from two aligned daily
// adjusted-close series. It is intentionally self-contained (no imports), so
// the pipeline can wire it in and tests never touch the network.
//
// Coverage note (2026-06 snapshot): 33 of the 886 distinct benchmarkIndex
// values resolve, covering ~155 of 1,348 ETFs via 21 distinct Yahoo symbols.
// The rest are bespoke theme/strategy indices, futures ('..._F'),
// leveraged/inverse, FX, or bond/money-market benchmarks with no public Yahoo
// series; those ETFs honestly keep null metrics instead of a proxy estimate.
//
// Methodology caveat, by design: ETF series are dividend-adjusted closes while
// Yahoo index series are price returns, so a steady positive active drift
// (roughly the distribution yield minus fees) is expected. It shows up in the
// information ratio; tracking error, being a deviation measure, is barely
// affected.

const TRADING_DAYS = 252;

// Minimum inner-joined daily points (~6 months of shared trading days) before
// the metrics are considered meaningful. Below this, both stay null.
export const MIN_TRACKING_OVERLAP_POINTS = 120;

/**
 * benchmarkIndex string (exactly as it occurs in the universe) -> Yahoo
 * Finance chart symbol. Lookups should go through
 * {@link resolveBenchmarkSymbol}, which normalizes case/whitespace and
 * tolerates an 'Index'/'지수' suffix.
 *
 * Deliberately unmapped (no workable public Yahoo index series):
 * - TOPIX ('TOPIX', 'JPX-EI-TOPIX'): Yahoo has no reliable TOPIX index symbol.
 * - KOSDAQ 150 ('KRX-EI-KSDQ150'): only the KOSDAQ Composite (^KQ11) exists
 *   on Yahoo, which is a different index.
 * - Futures benchmarks ('KRX-IX-KSP200_F', 'KRX-IX-KSDQ150_F', ...): rolling
 *   futures indices diverge from the spot index by carry/roll yield.
 * - 'KRX-IX-USDKRW': the ETFs track an FX *futures* index; comparing against
 *   the Yahoo spot rate (KRW=X) would misstate their tracking error.
 * - Leveraged/inverse benchmarks ('Nikkei 225 Leveraged', 'KRX-EI-KSEI2X', ...).
 * - 'MSCI-EI-EM' / 'MSCI Emerging Markets', 'VN30', 'FTSE China A50': no
 *   Yahoo index symbol we can verify.
 * - Bond/rate/commodity and bespoke theme indices (KAP/KIS/KOFR/SOFR/FnGuide/
 *   iSelect/Solactive/INDXX/NHIV/SPDJI strategy codes, ...).
 */
export const BENCHMARK_SYMBOLS = {
  // K-ETF vendor index codes (counts from the 2026-06 snapshot).
  'KRX-EI-KSP200': '^KS200', // KOSPI 200 (25 ETFs)
  'KRX-IX-KSP200tr': '^KS200', // KOSPI 200 Total Return; price-index proxy (9)
  'KRX-EI-KSP': '^KS11', // KOSPI Composite (12)
  'KRX-IX-KSPTR': '^KS11', // KOSPI Total Return; price-index proxy (2)
  'SPDJI-EI-SNP500': '^GSPC', // S&P 500 (23)
  'SPDJI-EI-INDUAVG': '^DJI', // Dow Jones Industrial Average (1)
  'XNAS-EI-NDX': '^NDX', // NASDAQ-100 (14)
  'XNAS-EI-XNDX': '^NDX', // NASDAQ-100 Total Return; price-index proxy (2)
  'XNAS-EI-SOX': '^SOX', // PHLX Semiconductor (2)
  'FTSERS-EI-RSSEL2000': '^RUT', // Russell 2000 (1)
  'CSI-EI-300': '000300.SS', // CSI 300 (7)
  'XSHG-EI-STAR50': '000688.SS', // SSE STAR 50 (4)
  'XSHE-EI-CHINEXT': '399006.SZ', // ChiNext (2)
  'HSI-EI-HSTECH': '^HSTECH', // Hang Seng TECH (5)
  'HSI-EI-HSCEI': '^HSCE', // Hang Seng China Enterprises (4)
  'XNSE-EI-NIFTY50': '^NSEI', // NIFTY 50 (5)
  'STOXX-EI-STOXX50': '^STOXX50E', // EURO STOXX 50 (3)
  'NIKKEI-EI-225': '^N225', // Nikkei 225 (2)
  'MSCI-EI-WORLD': '^990100-USD-STRD', // MSCI World; Yahoo's vendor-coded symbol (2)

  // Display names from universe.mjs (HK/DE/FR/JP/AU listings).
  'S&P 500': '^GSPC', // (4)
  'NASDAQ-100': '^NDX', // (5)
  'Russell 2000': '^RUT', // (1)
  'Nikkei 225': '^N225', // (2)
  'Hang Seng Index': '^HSI', // (1)
  'Hang Seng China Enterprises Index': '^HSCE', // (1)
  'Hang Seng TECH Index': '^HSTECH', // (4)
  'CSI 300': '000300.SS', // (2)
  'EURO STOXX 50': '^STOXX50E', // (2)
  'STOXX Europe 600': '^STOXX', // (1)
  DAX: '^GDAXI', // (1)
  'CAC 40': '^FCHI', // (1)
  'S&P/ASX 200': '^AXJO', // (2)
  'MSCI World': '^990100-USD-STRD', // (3)

  // Defensive aliases: today's K-ETF feed emits KRX codes, but earlier feeds
  // used display names. Cheap insurance against naming drift.
  'KOSPI 200': '^KS200',
  '코스피 200': '^KS200',
};

// Lowercase/whitespace-normalized lookup, plus an extra alias without a
// trailing ' index' for keys that carry one ('Hang Seng Index' -> 'hang seng').
const SYMBOL_BY_NORMALIZED_NAME = new Map();
for (const [name, symbol] of Object.entries(BENCHMARK_SYMBOLS)) {
  for (const key of [
    normalizeBenchmarkName(name),
    stripIndexSuffix(normalizeBenchmarkName(name)),
  ]) {
    const existing = SYMBOL_BY_NORMALIZED_NAME.get(key);
    if (existing !== undefined && existing !== symbol) {
      throw new Error(`BENCHMARK_SYMBOLS keys collide after normalization: ${name}`);
    }
    SYMBOL_BY_NORMALIZED_NAME.set(key, symbol);
  }
}

/**
 * Resolves a raw `benchmarkIndex` string to a Yahoo Finance chart symbol, or
 * null when the benchmark has no mapped public index series. Matching is
 * case-insensitive, NFKC- and whitespace-normalized, and tolerates a trailing
 * 'Index' / '지수' suffix in either the input or the map key.
 */
export function resolveBenchmarkSymbol(benchmarkIndex) {
  const normalized = normalizeBenchmarkName(benchmarkIndex);
  if (!normalized) return null;
  return (
    SYMBOL_BY_NORMALIZED_NAME.get(normalized) ??
    SYMBOL_BY_NORMALIZED_NAME.get(stripIndexSuffix(normalized)) ??
    null
  );
}

/**
 * Computes { trackingError3y, informationRatio3y } from two daily
 * adjusted-close series in the pipeline's `[{ date: 'YYYY-MM-DD', value }]`
 * shape (the ETF's trailing ~3y window and the benchmark chart series).
 *
 * The series are inner-joined by date, so the caller controls the window and
 * neither calendar alignment nor sort order is assumed. Hygiene matches
 * `validSeries` in src/lib/metrics.js: points with a missing/unparseable date
 * or a non-finite/non-positive value are dropped, and duplicate dates keep the
 * last valid occurrence.
 *
 * - trackingError3y: sample standard deviation of daily active returns
 *   (ETF simple return - benchmark simple return) x sqrt(252) x 100, in
 *   percent, rounded to 2 decimals.
 * - informationRatio3y: mean daily active return x 252 x 100 divided by the
 *   unrounded tracking error, rounded to 2 decimals. Null whenever the
 *   published tracking error rounds to zero (perfect or near-perfect tracker:
 *   a ratio against a displayed 0.00 would be meaningless) or is not finite.
 *
 * Fewer than {@link MIN_TRACKING_OVERLAP_POINTS} joined points returns
 * { trackingError3y: null, informationRatio3y: null }.
 */
export function computeTrackingMetrics(etfSeries, benchmarkSeries) {
  const nulls = { trackingError3y: null, informationRatio3y: null };

  const etfByDate = validPointsByDate(etfSeries);
  const benchmarkByDate = validPointsByDate(benchmarkSeries);
  const joined = [];
  for (const [date, etfPoint] of etfByDate) {
    const benchmarkPoint = benchmarkByDate.get(date);
    if (benchmarkPoint) {
      joined.push({ time: etfPoint.time, etf: etfPoint.value, benchmark: benchmarkPoint.value });
    }
  }
  if (joined.length < MIN_TRACKING_OVERLAP_POINTS) return nulls;
  joined.sort((a, b) => a.time - b.time);

  const active = [];
  for (let index = 1; index < joined.length; index += 1) {
    const previous = joined[index - 1];
    const current = joined[index];
    const etfReturn = current.etf / previous.etf - 1;
    const benchmarkReturn = current.benchmark / previous.benchmark - 1;
    active.push(etfReturn - benchmarkReturn);
  }
  if (active.length < 2) return nulls;

  const trackingErrorRaw = sampleStdDev(active) * Math.sqrt(TRADING_DAYS) * 100;
  const trackingError3y = roundNullable(trackingErrorRaw);
  if (trackingError3y === null) return nulls;

  const informationRatio3y =
    trackingError3y > 0
      ? roundNullable((mean(active) * TRADING_DAYS * 100) / trackingErrorRaw)
      : null;
  return { trackingError3y, informationRatio3y };
}

/**
 * dataQuality source attribution entry for an ETF whose tracking metrics were
 * computed against the given benchmark symbol's Yahoo chart series.
 */
export function trackingSourceEntry(symbol) {
  return {
    name: 'Yahoo Finance chart (benchmark)',
    url: `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
    fields: ['risk.trackingError3y', 'risk.informationRatio3y'],
  };
}

function normalizeBenchmarkName(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function stripIndexSuffix(normalized) {
  return normalized === null ? null : normalized.replace(/\s+(index|지수)$/, '');
}

// Map of date string -> { time, value }, keeping the last valid occurrence of
// each date (invalid points are dropped and never clobber a valid one).
function validPointsByDate(series) {
  const byDate = new Map();
  for (const point of series ?? []) {
    if (!point?.date || !isFiniteNumber(point.value) || point.value <= 0) continue;
    const time = Date.parse(point.date);
    if (!Number.isFinite(time)) continue;
    byDate.set(point.date, { time, value: point.value });
  }
  return byDate;
}

// Same semantics as isFiniteNumber in src/lib/metrics.js (kept local so this
// module stays dependency-free).
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// Same rounding semantics as roundNullable in scripts/data/yahoo.mjs.
function roundNullable(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function sampleStdDev(values) {
  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
