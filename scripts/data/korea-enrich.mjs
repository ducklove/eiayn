import {
  calculateAnnualizedReturn,
  calculateAnnualizedVolatility,
  calculateMaxDrawdown,
  calculatePeriodReturn,
  calculateSharpeRatio,
  normalizeSparkline,
  sliceSeriesFrom,
} from '../../src/lib/metrics.js';
import { computeTrackingMetrics, trackingSourceEntry } from './benchmark-tracking.mjs';
import { mapLimit } from './http.mjs';
import { buildPerformance1y } from './performance.mjs';
import { roundNullable, trailingDividendYield } from './yahoo.mjs';

export const KOREA_YAHOO_SOURCE_NAME = 'Yahoo Finance chart (KRX)';

/**
 * Enriches a built Korean ETF object with long-horizon metrics (and the 1y
 * weekly `performance1y` series as a fallback) computed from a Yahoo chart
 * result for the `${code}.KS` KRX symbol. K-ETF values always keep priority:
 * only fields that are currently null are filled. Returns the input object
 * unchanged (same reference) when there is nothing to fill, and never mutates
 * the input.
 */
export function applyKoreanYahooEnrichment(etf, chart, benchmark = null) {
  if (!etf || !chart) return etf;

  const series = (chart.series ?? []).map((point) => ({
    date: point.date,
    value: point.adjustedClose ?? point.close,
  }));
  const series3y = sliceSeriesFrom(series, { years: 3 });

  const filledFields = [];
  const enriched = {
    ...etf,
    returns: { ...(etf.returns ?? {}) },
    risk: { ...(etf.risk ?? {}) },
  };

  const fill = (target, key, label, value) => {
    if (target[key] !== null && target[key] !== undefined) return;
    if (value === null || value === undefined) return;
    target[key] = value;
    filledFields.push(label);
  };

  fill(
    enriched.returns,
    'm3',
    'returns.m3',
    roundNullable(calculatePeriodReturn(series, { months: 3 })),
  );
  fill(
    enriched.returns,
    'y1',
    'returns.y1',
    roundNullable(calculatePeriodReturn(series, { years: 1 })),
  );
  fill(
    enriched.returns,
    'y3Annualized',
    'returns.y3Annualized',
    roundNullable(calculateAnnualizedReturn(series, 3)),
  );
  fill(
    enriched.returns,
    'y5Annualized',
    'returns.y5Annualized',
    roundNullable(calculateAnnualizedReturn(series, 5)),
  );
  fill(
    enriched.risk,
    'volatility3yAnnualized',
    'risk.volatility3yAnnualized',
    roundNullable(calculateAnnualizedVolatility(series3y)),
  );
  fill(
    enriched.risk,
    'maxDrawdown3y',
    'risk.maxDrawdown3y',
    roundNullable(calculateMaxDrawdown(series3y)),
  );
  fill(enriched.risk, 'sharpe3y', 'risk.sharpe3y', roundNullable(calculateSharpeRatio(series3y)));
  fill(
    enriched,
    'dividendYield',
    'dividendYield',
    roundNullable(trailingDividendYield(chart.dividends ?? [], etf.price)),
  );
  // K-ETF data keeps priority: the 1y weekly performance series is filled
  // from the Yahoo chart only when the K-ETF build left it null.
  fill(enriched, 'performance1y', 'performance1y', buildPerformance1y(series));

  if (!etf.sparkline?.length) {
    const sparkline = normalizeSparkline(series);
    if (sparkline.length) {
      enriched.sparkline = sparkline;
      filledFields.push('sparkline');
    }
  }

  // Tracking metrics come from a separate benchmark index series, so they get
  // their own source attribution instead of the KRX chart entry.
  const trackingFilled = [];
  if (benchmark?.series && enriched.risk.trackingError3y == null) {
    const tracking = computeTrackingMetrics(series3y, benchmark.series);
    if (tracking.trackingError3y !== null) {
      enriched.risk.trackingError3y = tracking.trackingError3y;
      trackingFilled.push('risk.trackingError3y');
      if (tracking.informationRatio3y !== null && enriched.risk.informationRatio3y == null) {
        enriched.risk.informationRatio3y = tracking.informationRatio3y;
        trackingFilled.push('risk.informationRatio3y');
      }
    }
  }

  if (!filledFields.length && !trackingFilled.length) return etf;

  return {
    ...enriched,
    yahooSymbol: koreanYahooSymbol(etf.ticker),
    dataQuality: {
      ...etf.dataQuality,
      sources: [
        ...(etf.dataQuality?.sources ?? []),
        ...(filledFields.length
          ? [{ name: KOREA_YAHOO_SOURCE_NAME, url: chart.url, fields: filledFields }]
          : []),
        ...(trackingFilled.length ? [trackingSourceEntry(benchmark.symbol)] : []),
      ],
    },
  };
}

export function koreanYahooSymbol(ticker) {
  return `${ticker}.KS`;
}

/**
 * Selects which Korean ETFs to enrich. With no limit (null/undefined/NaN) all
 * ETFs are returned; with a numeric limit only the top-N by
 * liquidity.tradingValue (descending) are kept.
 */
export function selectKoreanYahooTargets(etfs, limit) {
  if (limit === null || limit === undefined || !Number.isFinite(limit)) return [...etfs];
  return [...etfs]
    .sort((a, b) => (b.liquidity?.tradingValue ?? 0) - (a.liquidity?.tradingValue ?? 0))
    .slice(0, Math.max(0, Math.floor(limit)));
}

/**
 * Enriches Korean ETFs with optional Yahoo KRX charts. Every fetch is
 * best-effort: a failed or empty chart leaves the ETF unchanged, no ETF is
 * ever excluded, and errors never propagate. Emits a single summary line.
 */
export async function enrichKoreanEtfsWithYahoo(etfs, options) {
  const {
    fetchChart,
    fetchBenchmark = null,
    limit = null,
    concurrency = 6,
    log = (message) => console.log(message),
  } = options;

  const targets = selectKoreanYahooTargets(etfs, limit);
  const enrichedById = new Map();
  let enrichedCount = 0;
  let failedCount = 0;
  let completed = 0;

  await mapLimit(targets, concurrency, async (etf) => {
    try {
      const chart = await fetchChart(koreanYahooSymbol(etf.ticker));
      const benchmark = fetchBenchmark ? await fetchBenchmark(etf) : null;
      const result = applyKoreanYahooEnrichment(etf, chart, benchmark);
      if (result !== etf) {
        enrichedById.set(etf.id, result);
        enrichedCount += 1;
      }
    } catch {
      failedCount += 1;
    }
    completed += 1;
    if (completed % 250 === 0 && completed < targets.length) {
      log(`[data:update] Korea Yahoo chart ${completed}/${targets.length}`);
    }
  });

  log(
    `[data:update] Korea Yahoo enrichment: ${enrichedCount}/${targets.length} enriched (${failedCount} unavailable)`,
  );
  return etfs.map((etf) => enrichedById.get(etf.id) ?? etf);
}
