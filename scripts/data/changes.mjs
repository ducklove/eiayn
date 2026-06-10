// Snapshot-to-snapshot diff (public/data/changes.json, schemaVersion 1).
//
// diffSnapshots(previous, next) powers the "오늘의 변화" feature and the RSS
// feed: new/removed listings, expense-ratio changes, and large AIYN score
// moves between two etfs.json payloads. Pure and deterministic.

export const CHANGES_SCHEMA_VERSION = 1;
export const SCORE_MOVE_MIN_DELTA = 5;
export const SCORE_MOVES_CAP = 20;
export const LISTINGS_CAP = 50;

// expenseRatio is stored rounded to 4 decimals; comparing at 1e4 integer
// precision means |Δ| >= 0.0001 while float noise (0.15 vs 0.15000000001)
// never registers as a change.
const FEE_PRECISION = 1e4;

/**
 * Diffs two snapshot payloads into the changes.json body.
 *
 * - `previousPayload` may be null/corrupt (first run, unreadable file): all
 *   change arrays stay empty and previousGeneratedAt is null unless the
 *   previous payload still carried a generatedAt string.
 * - newListings/delisted: id presence diff, capped at LISTINGS_CAP each, in
 *   snapshot display order (most relevant markets/liquidity first).
 * - feeChanges: both expense ratios non-null and |Δ| >= 0.0001 after the
 *   rounding-noise guard.
 * - scoreMoves: both aiynScores finite and |Δ| >= SCORE_MOVE_MIN_DELTA,
 *   sorted by |Δ| descending (id ascending tiebreak), capped at
 *   SCORE_MOVES_CAP.
 */
export function diffSnapshots(previousPayload, newPayload) {
  const newEtfs = etfList(newPayload);
  if (!newEtfs) {
    throw new TypeError('diffSnapshots: newPayload.etfs must be an array');
  }

  const changes = {
    schemaVersion: CHANGES_SCHEMA_VERSION,
    generatedAt: isoOrNull(newPayload?.generatedAt),
    previousGeneratedAt: isoOrNull(previousPayload?.generatedAt),
    newListings: [],
    delisted: [],
    feeChanges: [],
    scoreMoves: [],
  };

  const previousEtfs = etfList(previousPayload);
  if (!previousEtfs) return changes;

  const previousById = byId(previousEtfs);
  const newById = byId(newEtfs);

  changes.newListings = newEtfs
    .filter((etf) => hasId(etf) && !previousById.has(etf.id))
    .slice(0, LISTINGS_CAP)
    .map(listingEntry);

  changes.delisted = previousEtfs
    .filter((etf) => hasId(etf) && !newById.has(etf.id))
    .slice(0, LISTINGS_CAP)
    .map(listingEntry);

  for (const etf of newEtfs) {
    if (!hasId(etf)) continue;
    const previous = previousById.get(etf.id);
    if (!previous) continue;

    const fromFee = roundedFee(previous.expenseRatio);
    const toFee = roundedFee(etf.expenseRatio);
    if (fromFee !== null && toFee !== null && fromFee !== toFee) {
      changes.feeChanges.push({
        id: etf.id,
        name: etf.name ?? null,
        from: fromFee / FEE_PRECISION,
        to: toFee / FEE_PRECISION,
      });
    }

    const fromScore = finiteOrNull(previous.aiynScore);
    const toScore = finiteOrNull(etf.aiynScore);
    if (
      fromScore !== null &&
      toScore !== null &&
      Math.abs(toScore - fromScore) >= SCORE_MOVE_MIN_DELTA
    ) {
      changes.scoreMoves.push({ id: etf.id, name: etf.name ?? null, from: fromScore, to: toScore });
    }
  }

  changes.scoreMoves = changes.scoreMoves
    .sort(
      (a, b) =>
        Math.abs(b.to - b.from) - Math.abs(a.to - a.from) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, SCORE_MOVES_CAP);

  return changes;
}

function etfList(payload) {
  return Array.isArray(payload?.etfs) ? payload.etfs : null;
}

function byId(etfs) {
  const map = new Map();
  for (const etf of etfs) {
    if (hasId(etf)) map.set(etf.id, etf);
  }
  return map;
}

function hasId(etf) {
  return typeof etf?.id === 'string' && etf.id !== '';
}

function listingEntry(etf) {
  return { id: etf.id, name: etf.name ?? null, market: etf.market ?? null };
}

function isoOrNull(value) {
  return typeof value === 'string' && value !== '' ? value : null;
}

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Expense ratio scaled to an integer at 1e4 precision, or null. */
function roundedFee(value) {
  const fee = finiteOrNull(value);
  return fee === null ? null : Math.round(fee * FEE_PRECISION);
}
