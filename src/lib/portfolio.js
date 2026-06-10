// Simple, honest portfolio aggregation: normalized weights × per-ETF metrics.
// No correlation, rebalancing, or return modeling — the UI must state this
// assumption next to the result. Metrics skip ETFs whose field is null and
// renormalize weights within the remaining subset, reporting the coverage.
const MISSING_LABEL = '데이터 없음';

export function buildPortfolioSummary(entries) {
  const active = (entries ?? []).filter(
    (entry) => entry?.etf && isFiniteNumber(entry.weight) && entry.weight > 0,
  );
  const totalWeight = active.reduce((sum, entry) => sum + entry.weight, 0);
  if (!active.length || totalWeight <= 0) return null;

  const normalized = active.map((entry) => ({
    etf: entry.etf,
    weight: entry.weight / totalWeight,
  }));

  return {
    expenseRatio: weightedMetric(normalized, (etf) => etf.expenseRatio),
    dividendYield: weightedMetric(normalized, (etf) => etf.dividendYield),
    aiynScore: weightedMetric(normalized, (etf) => etf.aiynScore),
    themeBreakdown: weightBreakdown(normalized, (etf) => etf.theme),
    marketBreakdown: weightBreakdown(normalized, (etf) => etf.market),
  };
}

// Weighted average over the ETFs whose field is non-null, with weights
// renormalized within that subset. value is null when no ETF has the field.
function weightedMetric(normalized, pick) {
  const totalCount = normalized.length;
  const included = normalized.filter((entry) => isFiniteNumber(pick(entry.etf)));
  if (!included.length) return { value: null, includedCount: 0, totalCount };

  const includedWeight = included.reduce((sum, entry) => sum + entry.weight, 0);
  const value = included.reduce(
    (sum, entry) => sum + pick(entry.etf) * (entry.weight / includedWeight),
    0,
  );
  return { value, includedCount: included.length, totalCount };
}

function weightBreakdown(normalized, pick) {
  const totals = new Map();
  for (const entry of normalized) {
    const label = pick(entry.etf) ?? MISSING_LABEL;
    totals.set(label, (totals.get(label) ?? 0) + entry.weight);
  }
  return Array.from(totals, ([label, weight]) => ({
    label,
    weight: Math.round(weight * 1000) / 10,
  })).sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label, 'ko'));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
