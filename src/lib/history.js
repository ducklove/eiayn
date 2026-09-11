export function extractScoreSeries(history, etfId, scoreModelVersion) {
  const entries = history?.entries;
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(
      (entry) => !scoreModelVersion || (entry?.scoreModelVersion ?? '1.0.0') === scoreModelVersion,
    )
    .map((entry) => ({
      date: entry?.date,
      score: entry?.scores?.[etfId],
    }))
    .filter(
      (point) =>
        typeof point.date === 'string' &&
        typeof point.score === 'number' &&
        Number.isFinite(point.score),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function hasAnyChanges(changes) {
  if (!changes) return false;
  if (changes.scoreModelChange) return true;
  return ['newListings', 'delisted', 'feeChanges', 'scoreMoves'].some(
    (key) => Array.isArray(changes[key]) && changes[key].length > 0,
  );
}
