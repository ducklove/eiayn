import { isFiniteNumber } from './metrics.js';

const COMPONENT_WEIGHTS = {
  cost: 0.18,
  scale: 0.12,
  performance: 0.26,
  riskAdjusted: 0.22,
  tracking: 0.1,
  diversification: 0.12,
};

export function scoreEtfs(etfs) {
  const context = buildScoringContext(etfs);
  return etfs.map((etf) => {
    const components = scoreComponents(etf, context);
    const available = Object.entries(components).filter(([, value]) => isFiniteNumber(value));
    const availableWeight = available.reduce((sum, [key]) => sum + COMPONENT_WEIGHTS[key], 0);
    const aiynScore = availableWeight
      ? available.reduce((sum, [key, value]) => sum + value * (COMPONENT_WEIGHTS[key] / availableWeight), 0)
      : null;

    return {
      ...etf,
      aiynScore: isFiniteNumber(aiynScore) ? Math.round(aiynScore) : null,
      scoreCoverage: Number(availableWeight.toFixed(2)),
      scoreBreakdown: {
        수익성: roundScore(components.performance),
        가치: roundScore(weightedAverage([components.cost, components.scale])),
        안정성: roundScore(components.riskAdjusted),
        분산: roundScore(components.diversification),
        효율성: roundScore(weightedAverage([components.cost, components.tracking])),
      },
    };
  });
}

export function scoreComponents(etf, context) {
  const topHoldingConcentration = etf.holdings?.length
    ? etf.holdings.slice(0, 10).reduce((sum, holding) => sum + (holding.weight ?? 0), 0)
    : null;

  return {
    cost: normalizeLow(etf.expenseRatio, context.expenseRatio),
    scale: normalizeHigh(logOrNull(etf.aum), context.logAum),
    performance: weightedAverage([
      percentileHigh(etf.returns?.m3, context.m3Returns),
      percentileHigh(etf.returns?.y1, context.y1Returns),
      percentileHigh(etf.returns?.y3Annualized, context.y3AnnualizedReturns),
      percentileHigh(etf.returns?.y5Annualized, context.y5AnnualizedReturns),
    ], [0.2, 0.35, 0.25, 0.2]),
    riskAdjusted: weightedAverage([
      normalizeHigh(etf.risk?.sharpe3y, context.sharpe3y),
      normalizeLow(etf.risk?.volatility3yAnnualized, context.volatility3yAnnualized),
      normalizeLow(Math.abs(etf.risk?.maxDrawdown3y ?? Number.NaN), context.maxDrawdownAbs),
    ], [0.42, 0.3, 0.28]),
    tracking: weightedAverage([
      normalizeLow(etf.risk?.trackingError3y, context.trackingError3y),
      normalizeHigh(etf.risk?.informationRatio3y, context.informationRatio3y),
    ]),
    diversification: normalizeLow(topHoldingConcentration, context.topHoldingConcentration),
  };
}

export function buildScoringContext(etfs) {
  return {
    expenseRatio: extent(etfs.map((etf) => etf.expenseRatio)),
    logAum: extent(etfs.map((etf) => logOrNull(etf.aum))),
    m3Returns: distribution(etfs.map((etf) => etf.returns?.m3)),
    y1Returns: distribution(etfs.map((etf) => etf.returns?.y1)),
    y3AnnualizedReturns: distribution(etfs.map((etf) => etf.returns?.y3Annualized)),
    y5AnnualizedReturns: distribution(etfs.map((etf) => etf.returns?.y5Annualized)),
    volatility3yAnnualized: extent(etfs.map((etf) => etf.risk?.volatility3yAnnualized)),
    maxDrawdownAbs: extent(etfs.map((etf) => Math.abs(etf.risk?.maxDrawdown3y ?? Number.NaN))),
    sharpe3y: extent(etfs.map((etf) => etf.risk?.sharpe3y)),
    trackingError3y: extent(etfs.map((etf) => etf.risk?.trackingError3y)),
    informationRatio3y: extent(etfs.map((etf) => etf.risk?.informationRatio3y)),
    topHoldingConcentration: extent(etfs.map((etf) => (
      etf.holdings?.length
        ? etf.holdings.slice(0, 10).reduce((sum, holding) => sum + (holding.weight ?? 0), 0)
        : null
    ))),
  };
}

function extent(values) {
  const finite = values.filter(isFiniteNumber);
  if (!finite.length) return null;
  return { min: Math.min(...finite), max: Math.max(...finite) };
}

function distribution(values) {
  const finite = values.filter(isFiniteNumber).sort((a, b) => a - b);
  return finite.length ? finite : null;
}

function normalizeHigh(value, range) {
  if (!isFiniteNumber(value) || !range) return null;
  if (range.max === range.min) return 70;
  return clamp(((value - range.min) / (range.max - range.min)) * 100);
}

function normalizeLow(value, range) {
  if (!isFiniteNumber(value) || !range) return null;
  if (range.max === range.min) return 70;
  return clamp(((range.max - value) / (range.max - range.min)) * 100);
}

function percentileHigh(value, sortedValues) {
  if (!isFiniteNumber(value) || !sortedValues?.length) return null;
  if (sortedValues.length === 1) return 70;

  const firstEqual = lowerBound(sortedValues, value);
  const firstGreater = upperBound(sortedValues, value);
  const midpointRank = (firstEqual + firstGreater - 1) / 2;
  return clamp((midpointRank / (sortedValues.length - 1)) * 100);
}

function weightedAverage(values, weights = []) {
  const available = values
    .map((value, index) => ({ value, weight: weights[index] ?? 1 }))
    .filter(({ value }) => isFiniteNumber(value));
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return null;
  return available.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function roundScore(value) {
  return isFiniteNumber(value) ? Math.round(value) : null;
}

function logOrNull(value) {
  return isFiniteNumber(value) && value > 0 ? Math.log10(value) : null;
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function lowerBound(values, target) {
  let start = 0;
  let end = values.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (values[middle] < target) start = middle + 1;
    else end = middle;
  }
  return start;
}

function upperBound(values, target) {
  let start = 0;
  let end = values.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (values[middle] <= target) start = middle + 1;
    else end = middle;
  }
  return start;
}
