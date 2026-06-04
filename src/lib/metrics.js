const TRADING_DAYS = 252;

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function toFiniteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[,:%$₩]/g, '').trim();
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'n/a') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePercent(value) {
  return toFiniteNumber(value);
}

export function parseCompactMoney(value, fallbackCurrency) {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/,/g, '').trim();
  if (!trimmed || trimmed === '-' || /n\/a/i.test(trimmed)) return null;
  const currency = trimmed.includes('$') ? 'USD' : trimmed.includes('₩') ? 'KRW' : fallbackCurrency;
  const match = trimmed.match(/[-+]?\d*\.?\d+/);
  if (!match) return null;
  const upper = trimmed.toUpperCase();
  const multiplier = upper.includes('T')
    ? 1_000_000_000_000
    : upper.includes('B')
      ? 1_000_000_000
      : upper.includes('M')
        ? 1_000_000
        : 1;
  const valueNumber = Number(match[0]) * multiplier;
  return Number.isFinite(valueNumber) ? { value: valueNumber, currency } : null;
}

export function calculatePeriodReturn(series, period) {
  const points = validSeries(series);
  if (points.length < 2) return null;
  const end = points.at(-1);
  const target = shiftDate(new Date(end.date), period);
  const start = firstPointOnOrAfter(points, target);
  if (!start || start.date === end.date) return null;
  return ((end.value / start.value) - 1) * 100;
}

export function calculateAnnualizedReturn(series, years) {
  const periodReturn = calculatePeriodReturn(series, { years });
  if (!isFiniteNumber(periodReturn)) return null;
  return (Math.pow(1 + periodReturn / 100, 1 / years) - 1) * 100;
}

export function dailyReturns(series) {
  const points = validSeries(series);
  const returns = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1].value;
    const current = points[index].value;
    if (previous > 0 && current > 0) {
      returns.push((current / previous) - 1);
    }
  }
  return returns;
}

export function calculateAnnualizedVolatility(series) {
  const returns = dailyReturns(series);
  if (returns.length < 2) return null;
  const average = mean(returns);
  const variance = returns.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS) * 100;
}

export function calculateMaxDrawdown(series) {
  const points = validSeries(series);
  if (points.length < 2) return null;
  let peak = points[0].value;
  let maxDrawdown = 0;
  for (const point of points) {
    peak = Math.max(peak, point.value);
    if (peak > 0) {
      maxDrawdown = Math.min(maxDrawdown, (point.value / peak) - 1);
    }
  }
  return maxDrawdown * 100;
}

export function calculateSharpeRatio(series) {
  const volatility = calculateAnnualizedVolatility(series);
  const annualized = annualizedMeanReturn(series);
  if (!isFiniteNumber(volatility) || volatility === 0 || !isFiniteNumber(annualized)) return null;
  return annualized / volatility;
}

export function annualizedMeanReturn(series) {
  const returns = dailyReturns(series);
  if (!returns.length) return null;
  return mean(returns) * TRADING_DAYS * 100;
}

export function sliceSeriesFrom(series, period) {
  const points = validSeries(series);
  if (!points.length) return [];
  const end = new Date(points.at(-1).date);
  const target = shiftDate(end, period);
  return points.filter((point) => new Date(point.date) >= target);
}

export function normalizeSparkline(series, count = 28) {
  const points = validSeries(series).slice(-count);
  if (!points.length) return [];
  return points.map((point) => Number(point.value.toFixed(4)));
}

function validSeries(series) {
  return (series ?? [])
    .filter((point) => point?.date && isFiniteNumber(point.value) && point.value > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function firstPointOnOrAfter(points, targetDate) {
  const targetTime = targetDate.getTime();
  return points.find((point) => new Date(point.date).getTime() >= targetTime) ?? null;
}

function shiftDate(date, period) {
  const shifted = new Date(date);
  if (period.years) shifted.setFullYear(shifted.getFullYear() - period.years);
  if (period.months) shifted.setMonth(shifted.getMonth() - period.months);
  if (period.days) shifted.setDate(shifted.getDate() - period.days);
  return shifted;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
