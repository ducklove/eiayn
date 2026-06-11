// Canonical AIYN-score ranking over the full ETF universe.
//
// Shared by the AIYN 랭킹 view and the build-time JSON API
// (scripts/build-rankings.mjs) so both always agree on the order.

export const DEFAULT_RANKING_LIMIT = 100;

/**
 * Returns the top `limit` ETFs ordered by AIYN score (descending).
 *
 * - ETFs without a finite numeric `aiynScore` are excluded — missing data
 *   is never ranked as a zero.
 * - Ties break by `scoreCoverage` (desc, nulls last), then `aum`
 *   (desc, nulls last), then `id` (asc) for a deterministic order.
 * - The input array is not mutated.
 */
export function rankEtfsByScore(etfs, { limit = DEFAULT_RANKING_LIMIT } = {}) {
  return etfs
    .filter((etf) => Number.isFinite(etf?.aiynScore))
    .slice()
    .sort(
      (a, b) =>
        b.aiynScore - a.aiynScore ||
        compareNullableDesc(a.scoreCoverage, b.scoreCoverage) ||
        compareNullableDesc(a.aum, b.aum) ||
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
