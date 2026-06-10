// Rolling AIYN score history (public/data/history.json, schemaVersion 1).
//
// Every data refresh appends one entry per Asia/Seoul calendar day:
// { date: 'YYYY-MM-DD', generatedAt: ISO, scores: { [etfId]: integer } }.
// Re-running the pipeline on the same Seoul day REPLACES that day's entry,
// entries stay sorted ascending by date, and the file is pruned to the most
// recent HISTORY_MAX_ENTRIES days. All functions are pure.

export const HISTORY_SCHEMA_VERSION = 1;
export const HISTORY_MAX_ENTRIES = 60;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const SEOUL_DATE_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Asia/Seoul calendar date (YYYY-MM-DD) of an ISO datetime, or null. */
export function seoulDateOf(isoDatetime) {
  const time = Date.parse(typeof isoDatetime === 'string' ? isoDatetime : '');
  if (!Number.isFinite(time)) return null;
  const parts = {};
  for (const part of SEOUL_DATE_PARTS.formatToParts(time)) parts[part.type] = part.value;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Extracts the history entry for a snapshot payload:
 * { date (Asia/Seoul day of generatedAt), generatedAt, scores }.
 * ETFs with a null/non-finite aiynScore are omitted. Returns null when the
 * payload has no parseable generatedAt (callers skip the append and warn).
 */
export function historyFromSnapshot(payload) {
  const generatedAt = payload?.generatedAt;
  const date = seoulDateOf(generatedAt);
  if (!date) return null;

  const scores = {};
  const etfs = Array.isArray(payload?.etfs) ? payload.etfs : [];
  for (const etf of etfs) {
    const id = etf?.id;
    const score = etf?.aiynScore;
    if (typeof id !== 'string' || id === '') continue;
    if (typeof score !== 'number' || !Number.isFinite(score)) continue;
    scores[id] = Math.round(score);
  }
  return { date, generatedAt, scores };
}

/**
 * Returns a new history document with `entry` appended.
 *
 * - `history` may be null, corrupt, or partially corrupt: unusable documents
 *   start fresh and individually malformed entries are dropped.
 * - An existing entry with the same date is replaced (same-day re-runs).
 * - Entries are sorted ascending by date and pruned to the most recent
 *   HISTORY_MAX_ENTRIES.
 * - `updatedAt` becomes the appended entry's generatedAt, keeping the
 *   function pure and deterministic.
 *
 * Throws TypeError when `entry` itself is invalid (a programming error, not
 * a data-corruption case; callers wrap the whole computation non-fatally).
 */
export function appendHistoryEntry(history, entry) {
  const normalizedEntry = normalizeEntry(entry);
  if (!normalizedEntry) {
    throw new TypeError('appendHistoryEntry: entry must have a YYYY-MM-DD date and a generatedAt');
  }

  const byDate = new Map();
  for (const existing of sanitizeEntries(history)) byDate.set(existing.date, existing);
  byDate.set(normalizedEntry.date, normalizedEntry);

  const entries = Array.from(byDate.values())
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(-HISTORY_MAX_ENTRIES);

  return {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    updatedAt: normalizedEntry.generatedAt,
    entries,
  };
}

function sanitizeEntries(history) {
  if (!history || typeof history !== 'object' || !Array.isArray(history.entries)) return [];
  return history.entries.map(normalizeEntry).filter(Boolean);
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const { date, generatedAt } = entry;
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) return null;
  if (typeof generatedAt !== 'string' || generatedAt === '') return null;
  return { date, generatedAt, scores: normalizeScores(entry.scores) };
}

function normalizeScores(scores) {
  const normalized = {};
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) return normalized;
  for (const [id, value] of Object.entries(scores)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    normalized[id] = Math.round(value);
  }
  return normalized;
}
