import { describe, expect, it } from 'vitest';
import {
  CHANGES_SCHEMA_VERSION,
  diffSnapshots,
  LISTINGS_CAP,
  SCORE_MOVE_MIN_DELTA,
  SCORE_MOVES_CAP,
} from './changes.mjs';

function etf(id, overrides = {}) {
  return {
    id,
    name: `${id} ETF`,
    market: '미국',
    expenseRatio: 0.2,
    aiynScore: 70,
    ...overrides,
  };
}

function snapshot(etfs, generatedAt = '2026-06-10T21:40:00.000Z') {
  return { schemaVersion: 2, generatedAt, etfs };
}

describe('diffSnapshots', () => {
  it('returns empty arrays and a null previousGeneratedAt for the first run', () => {
    const result = diffSnapshots(null, snapshot([etf('QQQ')]));
    expect(result).toEqual({
      schemaVersion: CHANGES_SCHEMA_VERSION,
      generatedAt: '2026-06-10T21:40:00.000Z',
      previousGeneratedAt: null,
      newListings: [],
      delisted: [],
      feeChanges: [],
      scoreMoves: [],
    });
  });

  it('copies generatedAt from the new payload and previousGeneratedAt from the old one', () => {
    const result = diffSnapshots(
      snapshot([etf('QQQ')], '2026-06-09T21:40:00.000Z'),
      snapshot([etf('QQQ')], '2026-06-10T21:40:00.000Z'),
    );
    expect(result.generatedAt).toBe('2026-06-10T21:40:00.000Z');
    expect(result.previousGeneratedAt).toBe('2026-06-09T21:40:00.000Z');
  });

  it('detects new listings and delistings with id, name, and market', () => {
    const previous = snapshot([etf('QQQ'), etf('069500', { market: '국내', name: 'KODEX 200' })]);
    const next = snapshot([etf('QQQ'), etf('449450', { market: '국내', name: 'PLUS K방산' })]);
    const result = diffSnapshots(previous, next);
    expect(result.newListings).toEqual([{ id: '449450', name: 'PLUS K방산', market: '국내' }]);
    expect(result.delisted).toEqual([{ id: '069500', name: 'KODEX 200', market: '국내' }]);
  });

  it(`caps newListings and delisted at ${LISTINGS_CAP} each, keeping snapshot order`, () => {
    const previous = snapshot(
      Array.from({ length: LISTINGS_CAP + 5 }, (_, index) => etf(`OLD${index}`)),
    );
    const next = snapshot(Array.from({ length: LISTINGS_CAP + 5 }, (_, index) => etf(`N${index}`)));
    const result = diffSnapshots(previous, next);
    expect(result.newListings).toHaveLength(LISTINGS_CAP);
    expect(result.delisted).toHaveLength(LISTINGS_CAP);
    expect(result.newListings[0].id).toBe('N0');
    expect(result.delisted[0].id).toBe('OLD0');
  });

  it('reports fee changes when |delta| >= 0.0001 with both values non-null', () => {
    const previous = snapshot([
      etf('A', { expenseRatio: 0.15 }),
      etf('B', { expenseRatio: 0.15 }),
      etf('C', { expenseRatio: null }),
      etf('D', { expenseRatio: 0.3 }),
    ]);
    const next = snapshot([
      etf('A', { expenseRatio: 0.09 }),
      etf('B', { expenseRatio: 0.1501 }),
      etf('C', { expenseRatio: 0.2 }),
      etf('D', { expenseRatio: null }),
    ]);
    const result = diffSnapshots(previous, next);
    expect(result.feeChanges).toEqual([
      { id: 'A', name: 'A ETF', from: 0.15, to: 0.09 },
      { id: 'B', name: 'B ETF', from: 0.15, to: 0.1501 },
    ]);
  });

  it('is immune to floating-point rounding noise in expense ratios', () => {
    const previous = snapshot([
      etf('A', { expenseRatio: 0.15 }),
      etf('B', { expenseRatio: 0.0001 + 0.0002 }), // 0.00030000000000000003
    ]);
    const next = snapshot([
      etf('A', { expenseRatio: 0.15000000000004 }),
      etf('B', { expenseRatio: 0.0003 }),
    ]);
    expect(diffSnapshots(previous, next).feeChanges).toEqual([]);
  });

  it('ignores sub-threshold fee drift below 0.0001', () => {
    const previous = snapshot([etf('A', { expenseRatio: 0.15 })]);
    const next = snapshot([etf('A', { expenseRatio: 0.15004 })]);
    expect(diffSnapshots(previous, next).feeChanges).toEqual([]);
  });

  it(`reports score moves only when |delta| >= ${SCORE_MOVE_MIN_DELTA} and both scores exist`, () => {
    const previous = snapshot([
      etf('A', { aiynScore: 62 }),
      etf('B', { aiynScore: 50 }),
      etf('C', { aiynScore: 50 }),
      etf('D', { aiynScore: null }),
      etf('E', { aiynScore: 90 }),
    ]);
    const next = snapshot([
      etf('A', { aiynScore: 71 }),
      etf('B', { aiynScore: 55 }), // exactly +5 -> included
      etf('C', { aiynScore: 54 }), // +4 -> excluded
      etf('D', { aiynScore: 80 }), // null before -> excluded
      etf('E', { aiynScore: null }), // null after -> excluded
    ]);
    const result = diffSnapshots(previous, next);
    expect(result.scoreMoves).toEqual([
      { id: 'A', name: 'A ETF', from: 62, to: 71 },
      { id: 'B', name: 'B ETF', from: 50, to: 55 },
    ]);
  });

  it(`sorts score moves by |delta| desc (id asc tiebreak) and caps at ${SCORE_MOVES_CAP}`, () => {
    const count = SCORE_MOVES_CAP + 5;
    const previous = snapshot(
      Array.from({ length: count }, (_, index) => etf(`S${String(index).padStart(2, '0')}`)),
    );
    const next = snapshot(
      Array.from({ length: count }, (_, index) =>
        etf(`S${String(index).padStart(2, '0')}`, { aiynScore: 70 + SCORE_MOVE_MIN_DELTA + index }),
      ),
    );
    const result = diffSnapshots(previous, next);
    expect(result.scoreMoves).toHaveLength(SCORE_MOVES_CAP);
    // Largest |delta| first; the smallest five deltas fall off the cap.
    expect(result.scoreMoves[0].id).toBe(`S${String(count - 1).padStart(2, '0')}`);
    expect(result.scoreMoves.at(-1).id).toBe(
      `S${String(count - SCORE_MOVES_CAP).padStart(2, '0')}`,
    );

    const tied = diffSnapshots(
      snapshot([etf('Z', { aiynScore: 50 }), etf('A', { aiynScore: 50 })]),
      snapshot([etf('Z', { aiynScore: 60 }), etf('A', { aiynScore: 40 })]),
    );
    expect(tied.scoreMoves.map((move) => move.id)).toEqual(['A', 'Z']);
  });

  it('treats a previous payload without a usable etfs array as diffless', () => {
    const next = snapshot([etf('QQQ')]);
    for (const previous of [
      undefined,
      'garbage',
      { generatedAt: '2026-06-09T21:40:00.000Z' },
      { generatedAt: '2026-06-09T21:40:00.000Z', etfs: 'nope' },
    ]) {
      const result = diffSnapshots(previous, next);
      expect(result.newListings).toEqual([]);
      expect(result.delisted).toEqual([]);
      expect(result.feeChanges).toEqual([]);
      expect(result.scoreMoves).toEqual([]);
      expect(result.previousGeneratedAt).toBe(
        typeof previous === 'object' && previous ? previous.generatedAt : null,
      );
    }
  });

  it('ignores etfs without a usable id', () => {
    const previous = snapshot([etf('A'), { name: 'no id' }, null]);
    const next = snapshot([etf('A'), { id: '', name: 'empty id' }]);
    const result = diffSnapshots(previous, next);
    expect(result.newListings).toEqual([]);
    expect(result.delisted).toEqual([]);
  });

  it('reports an unchanged universe as no changes', () => {
    const etfs = [etf('A'), etf('B', { market: '국내' })];
    const result = diffSnapshots(snapshot(etfs), snapshot(etfs.map((item) => ({ ...item }))));
    expect(result.newListings).toEqual([]);
    expect(result.delisted).toEqual([]);
    expect(result.feeChanges).toEqual([]);
    expect(result.scoreMoves).toEqual([]);
  });

  it('throws a TypeError when the new payload has no etfs array', () => {
    expect(() => diffSnapshots(null, null)).toThrow(TypeError);
    expect(() => diffSnapshots(null, {})).toThrow(TypeError);
    expect(() => diffSnapshots(null, { etfs: 'nope' })).toThrow(TypeError);
  });
});
