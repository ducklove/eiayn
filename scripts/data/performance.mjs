import { isFiniteNumber } from '../../src/lib/metrics.js';

export const PERFORMANCE_1Y_FREQ = 'weekly';
// Below this many weekly points the series is too sparse to chart, so the
// field is emitted as null instead.
export const PERFORMANCE_1Y_MIN_POINTS = 8;

const DAY_MS = 86_400_000;

/**
 * Builds the optional per-ETF `performance1y` payload consumed by the
 * comparison overlay chart:
 *
 *   { start: 'YYYY-MM-DD', freq: 'weekly', values: [100, 101.23, ...] }
 *
 * Input is the pipeline's `[{ date: 'YYYY-MM-DD', value: number }]` series
 * shape. The series may arrive unsorted; points with a missing/unparseable
 * date or a non-finite/non-positive value are dropped (the same hygiene as
 * `validSeries` in src/lib/metrics.js). The remaining points are sliced to
 * the trailing one year from the latest point (inclusive boundary, matching
 * `sliceSeriesFrom`), then weekly-sampled by keeping the last available
 * trading point of each ISO week (Monday-Sunday), ending at the most recent
 * point. Values are normalized so `values[0]` is exactly 100 and later
 * points are `(price / start price) * 100` rounded to 2 decimals.
 *
 * Returns null when fewer than {@link PERFORMANCE_1Y_MIN_POINTS} weekly
 * points exist.
 */
export function buildPerformance1y(series) {
  const points = validDatedPoints(series);
  if (!points.length) return null;

  const cutoff = oneYearBefore(points.at(-1).time);
  const weekly = lastPointPerIsoWeek(points.filter((point) => point.time >= cutoff));
  if (weekly.length < PERFORMANCE_1Y_MIN_POINTS) return null;

  const startValue = weekly[0].value;
  return {
    start: isoDate(weekly[0].time),
    freq: PERFORMANCE_1Y_FREQ,
    values: weekly.map((point, index) =>
      index === 0 ? 100 : round2((point.value / startValue) * 100),
    ),
  };
}

/**
 * Sums the compact-JSON byte size of every non-null `performance1y` payload,
 * for the pipeline's size log line. Returns `{ etfsWithSeries, bytes }`.
 */
export function estimatePerformance1ySize(etfs) {
  let etfsWithSeries = 0;
  let bytes = 0;
  for (const etf of etfs ?? []) {
    if (!etf?.performance1y) continue;
    etfsWithSeries += 1;
    bytes += Buffer.byteLength(JSON.stringify(etf.performance1y), 'utf8');
  }
  return { etfsWithSeries, bytes };
}

function validDatedPoints(series) {
  return (series ?? [])
    .flatMap((point) => {
      if (!point?.date || !isFiniteNumber(point.value) || point.value <= 0) return [];
      const time = Date.parse(point.date);
      return Number.isFinite(time) ? [{ time, value: point.value }] : [];
    })
    .sort((a, b) => a.time - b.time);
}

// Calendar-year shift in UTC, mirroring shiftDate({ years: 1 }) in
// src/lib/metrics.js but timezone-independent.
function oneYearBefore(time) {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear() - 1, date.getUTCMonth(), date.getUTCDate());
}

// Points arrive sorted ascending, so later points of the same ISO week
// overwrite earlier ones and the Map keeps weeks in chronological order.
function lastPointPerIsoWeek(points) {
  const byWeek = new Map();
  for (const point of points) byWeek.set(isoWeekKey(point.time), point);
  return [...byWeek.values()];
}

// ISO-8601 weeks run Monday-Sunday. Identifying a week by the UTC midnight
// timestamp of its Thursday gives a stable grouping key without
// week-number arithmetic (UTC days are always exactly 24h).
function isoWeekKey(time) {
  const date = new Date(time);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const isoDay = new Date(midnight).getUTCDay() || 7; // Mon=1 .. Sun=7
  return midnight + (4 - isoDay) * DAY_MS;
}

function isoDate(time) {
  return new Date(time).toISOString().slice(0, 10);
}

// Same rounding semantics as roundNullable in scripts/data/yahoo.mjs.
function round2(value) {
  return Number(value.toFixed(2));
}
