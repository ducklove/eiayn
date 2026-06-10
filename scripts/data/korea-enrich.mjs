import {
  calculateAnnualizedReturn,
  calculateAnnualizedVolatility,
  calculateMaxDrawdown,
  calculatePeriodReturn,
  calculateSharpeRatio,
  normalizeSparkline,
  sliceSeriesFrom,
} from '../../src/lib/metrics.js';
import { mapLimit } from './http.mjs';
import { roundNullable, trailingDividendYield } from './yahoo.mjs';

export const KOREA_YAHOO_SOURCE_NAME = 'Yahoo Finance chart (KRX)';

/**
 * Enriches a built Korean ETF object with long-horizon metrics computed from a
 * Yahoo chart result for the `${code}.KS` KRX symbol. K-ETF values always keep
 * priority: only fields that are currently null are filled. Returns the input
 * object unchanged (same reference) when there is nothing to fill, and never
 * mutates the input.
 */
export function applyKoreanYahooEnrichment(etf, chart) {
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

  if (!etf.sparkline?.length) {
    const sparkline = normalizeSparkline(series);
    if (sparkline.length) {
      enriched.sparkline = sparkline;
      filledFields.push('sparkline');
    }
  }

  if (!filledFields.length) return etf;

  return {
    ...enriched,
    yahooSymbol: koreanYahooSymbol(etf.ticker),
    dataQuality: {
      ...etf.dataQuality,
      sources: [
        ...(etf.dataQuality?.sources ?? []),
        { name: KOREA_YAHOO_SOURCE_NAME, url: chart.url, fields: filledFields },
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
      const result = applyKoreanYahooEnrichment(etf, chart);
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
