// Canonical AIYN-score ranking over the full ETF universe.
//
// Shared by the AIYN 랭킹 view and the build-time JSON API
// (scripts/build-rankings.mjs) so both always agree on the order.

import { comparableAum } from './currency.js';

export const DEFAULT_RANKING_LIMIT = 100;

export function readRankingFilters(params, etfs) {
  const market = params.get('rankMarket') ?? '';
  const assetClass = params.get('rankAssetClass') ?? '';
  const minCoverage = Number(params.get('rankCoverage') ?? 0);
  return {
    market: etfs.some((etf) => etf.market === market) ? market : '',
    assetClass: etfs.some((etf) => etf.assetClass === assetClass) ? assetClass : '',
    minCoverage: [0, 0.8, 1].includes(minCoverage) ? minCoverage : 0,
  };
}

export function writeRankingFilters(params, filters) {
  for (const [key, value] of Object.entries({
    rankMarket: filters.market,
    rankAssetClass: filters.assetClass,
    rankCoverage: filters.minCoverage,
  })) {
    if (value) params.set(key, String(value));
    else params.delete(key);
  }
  return params;
}

/**
 * Returns the top `limit` ETFs ordered by AIYN score (descending).
 *
 * - ETFs without a finite numeric `aiynScore` are excluded — missing data
 *   is never ranked as a zero.
 * - Ties break by `scoreCoverage` (desc, nulls last), then `aum`
 *   (desc, nulls last), then `id` (asc) for a deterministic order.
 * - The input array is not mutated.
 */
export function rankEtfsByScore(
  etfs,
  { limit = DEFAULT_RANKING_LIMIT, market = '', assetClass = '', minCoverage = 0 } = {},
) {
  return etfs
    .filter((etf) => Number.isFinite(etf?.aiynScore))
    .filter(
      (etf) =>
        (!market || etf.market === market) &&
        (!assetClass || etf.assetClass === assetClass) &&
        (minCoverage === 0 || etf.scoreCoverage >= minCoverage),
    )
    .slice()
    .sort(
      (a, b) =>
        b.aiynScore - a.aiynScore ||
        compareNullableDesc(a.scoreCoverage, b.scoreCoverage) ||
        compareNullableDesc(comparableAum(a), comparableAum(b)) ||
        String(a.id).localeCompare(String(b.id)),
    )
    .slice(0, limit);
}

function compareNullableDesc(a, b) {
  const aValid = Number.isFinite(a);
  const bValid = Number.isFinite(b);
  if (aValid && bValid) return b - a;
  if (aValid) return -1;
  if (bValid) return 1;
  return 0;
}
