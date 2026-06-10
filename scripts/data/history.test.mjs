import { describe, expect, it } from 'vitest';
import {
  appendHistoryEntry,
  HISTORY_MAX_ENTRIES,
  HISTORY_SCHEMA_VERSION,
  historyFromSnapshot,
  seoulDateOf,
} from './history.mjs';

function entryFor(date, scores = { QQQ: 84 }) {
  return { date, generatedAt: `${date}T00:30:00.000Z`, scores };
}

describe('seoulDateOf', () => {
  it('returns the Asia/Seoul calendar date of an ISO datetime', () => {
    // 02:32 UTC is 11:32 KST the same day.
    expect(seoulDateOf('2026-06-05T02:32:08.842Z')).toBe('2026-06-05');
  });

  it('rolls into the next Seoul day after 15:00 UTC', () => {
    expect(seoulDateOf('2026-06-05T14:59:59.999Z')).toBe('2026-06-05');
    expect(seoulDateOf('2026-06-05T15:00:00.000Z')).toBe('2026-06-06');
    expect(seoulDateOf('2026-12-31T16:00:00.000Z')).toBe('2027-01-01');
  });

  it('returns null for unparseable input', () => {
    expect(seoulDateOf(null)).toBeNull();
    expect(seoulDateOf(undefined)).toBeNull();
    expect(seoulDateOf('')).toBeNull();
    expect(seoulDateOf('not-a-date')).toBeNull();
    expect(seoulDateOf(1234567890)).toBeNull();
  });
});

describe('historyFromSnapshot', () => {
  it('extracts the Seoul date, generatedAt, and integer scores by id', () => {
    const payload = {
      generatedAt: '2026-06-09T21:40:00.000Z',
      etfs: [
        { id: '069500', aiynScore: 71 },
        { id: 'QQQ', aiynScore: 84 },
      ],
    };
    expect(historyFromSnapshot(payload)).toEqual({
      date: '2026-06-10', // 21:40 UTC -> 06:40 KST next day
      generatedAt: '2026-06-09T21:40:00.000Z',
      scores: { '069500': 71, QQQ: 84 },
    });
  });

  it('omits ETFs with null or non-finite scores and entries without an id', () => {
    const payload = {
      generatedAt: '2026-06-05T02:00:00.000Z',
      etfs: [
        { id: 'A', aiynScore: 55 },
        { id: 'B', aiynScore: null },
        { id: 'C', aiynScore: Number.NaN },
        { id: 'D', aiynScore: Infinity },
        { id: 'E', aiynScore: '70' },
        { id: 'F' },
        { id: '', aiynScore: 10 },
        { aiynScore: 10 },
        null,
      ],
    };
    expect(historyFromSnapshot(payload).scores).toEqual({ A: 55 });
  });

  it('rounds non-integer scores defensively', () => {
    const payload = {
      generatedAt: '2026-06-05T02:00:00.000Z',
      etfs: [{ id: 'A', aiynScore: 70.6 }],
    };
    expect(historyFromSnapshot(payload).scores).toEqual({ A: 71 });
  });

  it('returns null when generatedAt is missing or unparseable', () => {
    expect(historyFromSnapshot(null)).toBeNull();
    expect(historyFromSnapshot({})).toBeNull();
    expect(historyFromSnapshot({ generatedAt: 'garbage', etfs: [] })).toBeNull();
  });

  it('treats a missing etfs array as zero scores', () => {
    expect(historyFromSnapshot({ generatedAt: '2026-06-05T02:00:00.000Z' }).scores).toEqual({});
  });
});

describe('appendHistoryEntry', () => {
  it('starts a fresh document from null or corrupt history', () => {
    const entry = entryFor('2026-06-10');
    for (const corrupt of [null, undefined, 'garbage', 42, [], { entries: 'nope' }, {}]) {
      expect(appendHistoryEntry(corrupt, entry)).toEqual({
        schemaVersion: HISTORY_SCHEMA_VERSION,
        updatedAt: entry.generatedAt,
        entries: [entry],
      });
    }
  });

  it('replaces the entry for the same calendar date (same-day re-run)', () => {
    const first = appendHistoryEntry(null, entryFor('2026-06-10', { QQQ: 80 }));
    const second = appendHistoryEntry(first, {
      date: '2026-06-10',
      generatedAt: '2026-06-10T08:00:00.000Z',
      scores: { QQQ: 84 },
    });
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0].scores).toEqual({ QQQ: 84 });
    expect(second.entries[0].generatedAt).toBe('2026-06-10T08:00:00.000Z');
    expect(second.updatedAt).toBe('2026-06-10T08:00:00.000Z');
  });

  it('keeps entries sorted ascending by date', () => {
    let history = null;
    for (const date of ['2026-06-10', '2026-06-08', '2026-06-09']) {
      history = appendHistoryEntry(history, entryFor(date));
    }
    expect(history.entries.map((entry) => entry.date)).toEqual([
      '2026-06-08',
      '2026-06-09',
      '2026-06-10',
    ]);
  });

  it(`prunes to the most recent ${HISTORY_MAX_ENTRIES} entries`, () => {
    let history = null;
    for (let day = 0; day < HISTORY_MAX_ENTRIES + 5; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
      history = appendHistoryEntry(history, entryFor(date));
    }
    expect(history.entries).toHaveLength(HISTORY_MAX_ENTRIES);
    expect(history.entries[0].date).toBe('2026-01-06'); // first five days pruned
    expect(history.entries.at(-1).date).toBe('2026-03-06');
  });

  it('drops malformed existing entries and normalizes scores', () => {
    const corrupt = {
      schemaVersion: HISTORY_SCHEMA_VERSION,
      updatedAt: '2026-06-09T00:30:00.000Z',
      entries: [
        entryFor('2026-06-09', { A: 50.4, B: 'oops', C: null, D: Infinity }),
        { date: 'June 8', generatedAt: '2026-06-08T00:30:00.000Z', scores: {} },
        { date: '2026-06-07' }, // missing generatedAt
        { date: '2026-06-06', generatedAt: '2026-06-06T00:30:00.000Z', scores: [1, 2] },
        'garbage',
        null,
      ],
    };
    const history = appendHistoryEntry(corrupt, entryFor('2026-06-10'));
    expect(history.entries.map((entry) => entry.date)).toEqual([
      '2026-06-06',
      '2026-06-09',
      '2026-06-10',
    ]);
    expect(history.entries[0].scores).toEqual({});
    expect(history.entries[1].scores).toEqual({ A: 50 });
  });

  it('dedupes duplicate dates already present in a corrupt document', () => {
    const corrupt = {
      entries: [entryFor('2026-06-09', { A: 1 }), entryFor('2026-06-09', { A: 2 })],
    };
    const history = appendHistoryEntry(corrupt, entryFor('2026-06-10'));
    expect(history.entries.map((entry) => entry.date)).toEqual(['2026-06-09', '2026-06-10']);
    expect(history.entries[0].scores).toEqual({ A: 2 });
  });

  it('does not mutate its inputs', () => {
    const previous = appendHistoryEntry(null, entryFor('2026-06-09'));
    const frozenLike = JSON.parse(JSON.stringify(previous));
    appendHistoryEntry(previous, entryFor('2026-06-10'));
    expect(previous).toEqual(frozenLike);
  });

  it('throws a TypeError for an invalid new entry', () => {
    expect(() => appendHistoryEntry(null, null)).toThrow(TypeError);
    expect(() => appendHistoryEntry(null, {})).toThrow(TypeError);
    expect(() => appendHistoryEntry(null, { date: 'nope', generatedAt: 'x' })).toThrow(TypeError);
    expect(() => appendHistoryEntry(null, { date: '2026-06-10' })).toThrow(TypeError);
  });

  it('matches the published history.json contract shape', () => {
    const history = appendHistoryEntry(null, {
      date: '2026-06-10',
      generatedAt: '2026-06-10T06:30:00.000+09:00',
      scores: { '069500': 71, QQQ: 84 },
    });
    expect(history).toEqual({
      schemaVersion: 1,
      updatedAt: '2026-06-10T06:30:00.000+09:00',
      entries: [
        {
          date: '2026-06-10',
          generatedAt: '2026-06-10T06:30:00.000+09:00',
          scores: { '069500': 71, QQQ: 84 },
        },
      ],
    });
  });
});
