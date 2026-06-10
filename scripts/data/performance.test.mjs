import { describe, expect, it } from 'vitest';
import {
  buildPerformance1y,
  estimatePerformance1ySize,
  PERFORMANCE_1Y_FREQ,
  PERFORMANCE_1Y_MIN_POINTS,
} from './performance.mjs';

const DAY_MS = 86_400_000;

function isoDate(time) {
  return new Date(time).toISOString().slice(0, 10);
}

// One point per ISO week, on consecutive Mondays ending at `lastMonday`.
function mondaySeries(lastMonday, count, valueAt = (index) => 200 + index) {
  const end = Date.parse(lastMonday);
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const time = end - (count - 1 - index) * 7 * DAY_MS;
    points.push({ date: isoDate(time), value: valueAt(index) });
  }
  return points;
}

// Nine ISO weeks (Mon-Sun), June-July 2025, several points per week. The
// expected weekly sample of each week is marked; the start anchor is the
// last point of the first week (Sunday 2025-06-08, value 102).
const SAMPLING_FIXTURE = [
  { date: '2025-06-02', value: 100 }, // week 1 Mon
  { date: '2025-06-06', value: 101 }, // week 1 Fri
  { date: '2025-06-08', value: 102 }, // week 1 Sun <- sample (Sunday closes the ISO week)
  { date: '2025-06-09', value: 98 }, // week 2 Mon
  { date: '2025-06-13', value: 107.1 }, // week 2 Fri <- sample
  { date: '2025-06-16', value: 99 }, // week 3 Mon
  { date: '2025-06-20', value: 96.9 }, // week 3 Fri <- sample
  { date: '2025-06-23', value: 97 }, // week 4 Mon
  { date: '2025-06-27', value: 102 }, // week 4 Fri <- sample
  { date: '2025-06-30', value: 96 }, // week 5 Mon
  { date: '2025-07-04', value: 110.16 }, // week 5 Fri <- sample
  { date: '2025-07-07', value: 95 }, // week 6 Mon
  { date: '2025-07-11', value: 51 }, // week 6 Fri <- sample
  { date: '2025-07-14', value: 94 }, // week 7 Mon
  { date: '2025-07-18', value: 153 }, // week 7 Fri <- sample
  { date: '2025-07-21', value: 93 }, // week 8 Mon
  { date: '2025-07-25', value: 100.98 }, // week 8 Fri <- sample
  { date: '2025-07-28', value: 92 }, // week 9 Mon
  { date: '2025-07-30', value: 103.02 }, // week 9 Wed <- sample (most recent point)
];

const SAMPLING_EXPECTED = {
  start: '2025-06-08',
  freq: 'weekly',
  values: [100, 105, 95, 100, 108, 50, 150, 99, 101],
};

describe('buildPerformance1y', () => {
  it('samples the last available trading point of each ISO week (Mon-Sun)', () => {
    expect(buildPerformance1y(SAMPLING_FIXTURE)).toEqual(SAMPLING_EXPECTED);
  });

  it('slices to the trailing one year from the latest point', () => {
    // Mondays 2024-06-03 .. 2026-06-08 (106 points). The cutoff is exactly
    // one year before the latest point (2025-06-08), so the 53 Mondays from
    // 2025-06-09 onward stay and everything earlier is dropped.
    const end = Date.parse('2026-06-08');
    const cutoff = Date.parse('2025-06-09');
    const series = mondaySeries('2026-06-08', 106, () => 0).map((point, index) => ({
      date: point.date,
      value: Date.parse(point.date) < cutoff ? 50 : 200 + (index - 53),
    }));
    expect(Date.parse(series[0].date)).toBe(Date.parse('2024-06-03'));
    expect(Date.parse(series.at(-1).date)).toBe(end);

    const result = buildPerformance1y(series);

    expect(result.start).toBe('2025-06-09');
    expect(result.values).toHaveLength(53);
    expect(result.values[0]).toBe(100);
    // value = 200 + i at the in-window Mondays => (200 + i) / 200 * 100
    expect(result.values[1]).toBe(100.5);
    expect(result.values.at(-1)).toBe(126);
  });

  it('includes a point exactly one year before the latest point (inclusive boundary)', () => {
    // Adding Sunday 2025-06-08 (exactly latest minus one year) to the
    // 53-Monday window: it is included and belongs to the previous Mon-Sun
    // ISO week, becoming the new start anchor.
    const series = [
      { date: '2025-06-08', value: 160 },
      ...mondaySeries('2026-06-08', 53, (index) => 200 + index),
    ];

    const result = buildPerformance1y(series);

    expect(result.start).toBe('2025-06-08');
    expect(result.values).toHaveLength(54);
    expect(result.values[0]).toBe(100);
    expect(result.values[1]).toBe(125); // 200 / 160 * 100
  });

  it('normalizes to 100 at the start with 2-decimal rounding', () => {
    const values = [3, 3.1, 3.05, 6, 1.5, 4.5, 3, 2.99];
    const result = buildPerformance1y(mondaySeries('2025-07-21', 8, (index) => values[index]));

    expect(result.values).toEqual([100, 103.33, 101.67, 200, 50, 150, 100, 99.67]);
    expect(Object.is(result.values[0], 100)).toBe(true);
  });

  it('returns null when fewer than 8 weekly points exist', () => {
    expect(PERFORMANCE_1Y_MIN_POINTS).toBe(8);
    expect(buildPerformance1y(mondaySeries('2025-07-14', 7))).toBeNull();
    expect(buildPerformance1y(mondaySeries('2025-07-21', 8))).not.toBeNull();

    // 30 consecutive daily points only span 5 ISO weeks.
    const daily = Array.from({ length: 30 }, (_, index) => ({
      date: isoDate(Date.parse('2025-05-01') + index * DAY_MS),
      value: 100 + index,
    }));
    expect(buildPerformance1y(daily)).toBeNull();

    expect(buildPerformance1y([])).toBeNull();
    expect(buildPerformance1y(null)).toBeNull();
    expect(buildPerformance1y(undefined)).toBeNull();
  });

  it('tolerates unsorted input', () => {
    const shuffled = [...SAMPLING_FIXTURE].reverse();
    shuffled.push(shuffled.shift());
    expect(buildPerformance1y(shuffled)).toEqual(SAMPLING_EXPECTED);
  });

  it('filters invalid and non-positive points', () => {
    const dirty = [
      { date: '2025-06-04', value: 0 }, // would otherwise become week 1's sample
      { date: '2025-06-05', value: -5 },
      { date: '2025-06-11', value: Number.NaN },
      { date: '2025-06-12', value: Infinity },
      { date: '2025-06-18', value: null },
      { date: '2025-06-19', value: '210' }, // string values are not numbers
      { date: null, value: 250 },
      { date: '', value: 250 },
      { date: 'not-a-date', value: 250 },
      null,
      undefined,
      {},
      ...SAMPLING_FIXTURE,
    ];
    expect(buildPerformance1y(dirty)).toEqual(SAMPLING_EXPECTED);
    expect(buildPerformance1y(dirty.slice(0, 12))).toBeNull();
  });

  it('is deterministic on a fixed fixture', () => {
    const first = buildPerformance1y(SAMPLING_FIXTURE);
    const second = buildPerformance1y(SAMPLING_FIXTURE);
    expect(first).toEqual(second);
    expect(first.freq).toBe(PERFORMANCE_1Y_FREQ);
    expect(first).toEqual(SAMPLING_EXPECTED);
  });
});

describe('estimatePerformance1ySize', () => {
  it('counts only non-null payloads and sums their compact-JSON bytes', () => {
    const payload = buildPerformance1y(SAMPLING_FIXTURE);
    const { etfsWithSeries, bytes } = estimatePerformance1ySize([
      { id: 'A', performance1y: payload },
      { id: 'B', performance1y: null },
      { id: 'C' },
      null,
    ]);
    expect(etfsWithSeries).toBe(1);
    expect(bytes).toBe(Buffer.byteLength(JSON.stringify(payload), 'utf8'));
    expect(estimatePerformance1ySize([])).toEqual({ etfsWithSeries: 0, bytes: 0 });
    expect(estimatePerformance1ySize(null)).toEqual({ etfsWithSeries: 0, bytes: 0 });
  });

  it('keeps a full-year weekly payload within the per-ETF size budget', () => {
    // A trailing year holds ~53 weekly samples. At 2-decimal precision one
    // payload stays under 600 bytes, so ~1,348 ETFs cost well under ~1 MB raw.
    const payload = buildPerformance1y(
      mondaySeries('2026-06-08', 60, (index) => 80 * (1 + ((index * 7919) % 997) / 2000)),
    );
    expect(payload.values).toHaveLength(53);
    const { bytes } = estimatePerformance1ySize([{ performance1y: payload }]);
    expect(bytes).toBeGreaterThan(300);
    expect(bytes).toBeLessThan(600);
  });
});
