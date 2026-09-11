import { describe, expect, it } from 'vitest';
import { extractScoreSeries, hasAnyChanges } from './history.js';

describe('extractScoreSeries', () => {
  const history = {
    schemaVersion: 1,
    entries: [
      { date: '2026-06-12', scores: { QQQ: 84, '069500': 71 } },
      { date: '2026-06-10', scores: { QQQ: 82 } },
      { date: '2026-06-11', scores: { '069500': 70 } },
      { date: '2026-06-13', scores: { QQQ: null } },
    ],
  };

  it('returns the per-ETF series sorted by date, skipping missing scores', () => {
    expect(extractScoreSeries(history, 'QQQ')).toEqual([
      { date: '2026-06-10', score: 82 },
      { date: '2026-06-12', score: 84 },
    ]);
    expect(extractScoreSeries(history, '069500')).toEqual([
      { date: '2026-06-11', score: 70 },
      { date: '2026-06-12', score: 71 },
    ]);
  });

  it('handles absent history or unknown ids', () => {
    expect(extractScoreSeries(null, 'QQQ')).toEqual([]);
    expect(extractScoreSeries({}, 'QQQ')).toEqual([]);
    expect(extractScoreSeries(history, 'NOPE')).toEqual([]);
  });
});

describe('hasAnyChanges', () => {
  it('detects any non-empty change group', () => {
    expect(hasAnyChanges(null)).toBe(false);
    expect(hasAnyChanges({ newListings: [], feeChanges: [] })).toBe(false);
    expect(hasAnyChanges({ newListings: [{ id: 'A' }] })).toBe(true);
    expect(hasAnyChanges({ scoreMoves: [{ id: 'B', from: 60, to: 70 }] })).toBe(true);
  });
});

it('같은 산식의 이력만 비교한다', () => {
  const history = {
    entries: [
      { date: '2026-09-09', scores: { A: 90 } },
      { date: '2026-09-10', scoreModelVersion: '1.0.0', scores: { A: 85 } },
      { date: '2026-09-11', scoreModelVersion: '2.0.0', scores: { A: 70 } },
    ],
  };
  expect(extractScoreSeries(history, 'A', '2.0.0')).toEqual([{ date: '2026-09-11', score: 70 }]);
  expect(extractScoreSeries(history, 'A', '1.0.0')).toHaveLength(2);
});
