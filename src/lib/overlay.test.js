import { describe, expect, it } from 'vitest';
import { buildOverlaySeries } from './overlay.js';

function etf(id, values) {
  return { id, shortName: id, performance1y: { start: '2025-06-13', freq: 'weekly', values } };
}

describe('buildOverlaySeries', () => {
  it('returns null when fewer than two ETFs have series data', () => {
    expect(buildOverlaySeries([etf('A', [100, 110])])).toBeNull();
    expect(buildOverlaySeries([etf('A', [100, 110]), { id: 'B', performance1y: null }])).toBeNull();
    expect(buildOverlaySeries([])).toBeNull();
  });

  it('trims to the shortest series from the end and re-normalizes to 100', () => {
    const result = buildOverlaySeries([
      etf('LONG', [100, 110, 121, 133.1]),
      etf('SHORT', [100, 105]),
    ]);

    expect(result.window).toBe(2);
    // LONG keeps its last two points (121 -> 133.1), re-based to 100.
    expect(result.series[0].values[0]).toBeCloseTo(100);
    expect(result.series[0].values[1]).toBeCloseTo(110);
    expect(result.series[1].values).toEqual([100, 105]);
  });

  it('reports per-series change and global min/max for axis scaling', () => {
    const result = buildOverlaySeries([etf('UP', [100, 120]), etf('DOWN', [100, 80])]);

    expect(result.series.find((s) => s.id === 'UP').changePercent).toBeCloseTo(20);
    expect(result.series.find((s) => s.id === 'DOWN').changePercent).toBeCloseTo(-20);
    expect(result.min).toBeCloseTo(80);
    expect(result.max).toBeCloseTo(120);
  });

  it('skips ETFs without data while keeping the rest', () => {
    const result = buildOverlaySeries([
      etf('A', [100, 110, 105]),
      { id: 'NO-DATA', shortName: 'NO-DATA' },
      etf('B', [100, 90, 95]),
    ]);

    expect(result.series.map((s) => s.id)).toEqual(['A', 'B']);
  });
});
