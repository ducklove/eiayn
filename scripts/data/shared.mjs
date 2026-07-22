// Snapshot keeps up to 25 holdings per ETF for the UI. The AIYN
// diversification score still uses only the top 10 (src/lib/scoring.js slices
// holdings to 10), so scores are unaffected by this limit.
export const HOLDINGS_LIMIT = 25;

export function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function emptyProfile() {
  return {
    source: null,
    expenseRatio: null,
    aum: null,
    dividendYield: null,
    inceptionDate: null,
  };
}
