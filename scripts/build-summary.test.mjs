import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRankingsPayload } from './build-rankings.mjs';
import {
  buildEiaynSummary,
  buildSummaryEnvelope,
  publishSummary,
  SUMMARY_SOURCES,
} from './build-summary.mjs';
import { contentHash, validateEnvelope } from './vc-publish.mjs';

const CODE_RE = /^[A-Z0-9][A-Z0-9.-]{0,29}$/;

function etf(id, aiynScore, overrides = {}) {
  return {
    id,
    ticker: id,
    name: `${id} ETF`,
    shortName: ` ${id} `,
    market: '국내',
    aiynScore,
    scoreCoverage: 1,
    returns: {},
    ...overrides,
  };
}

const snapshot = (etfs, extra = {}) => ({
  generatedAt: '2026-09-25T12:05:35.816Z',
  scoreModelVersion: '2.0.0',
  universe: etfs.map((item) => item.id),
  etfs,
  ...extra,
});

// Mirrors the required keys and patterns of value-invest
// config/schemas/summary/eiayn.schema.json (no JSON-schema dependency here).
function expectSchemaShape(data) {
  expect(Object.keys(data).sort()).toEqual([
    'rankings',
    'scoreModelVersion',
    'universe',
    'universeSize',
  ]);
  expect(Number.isInteger(data.universeSize)).toBe(true);
  expect(data.universeSize).toBe(data.universe.length);
  expect(new Set(data.universe).size).toBe(data.universe.length);
  expect([...data.universe].sort()).toEqual(data.universe);
  for (const code of data.universe) expect(code).toMatch(CODE_RE);
  expect(data.rankings.length).toBeLessThanOrEqual(100);
  for (const entry of data.rankings) {
    expect(Object.keys(entry).sort()).toEqual(['code', 'market', 'name', 'rank', 'score']);
    expect(Number.isInteger(entry.rank) && entry.rank >= 1).toBe(true);
    expect(entry.code).toMatch(CODE_RE);
    expect(entry.score === null || typeof entry.score === 'number').toBe(true);
  }
}

let dirs = [];
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});
function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'eiayn-summary-'));
  dirs.push(dir);
  return dir;
}

describe('buildEiaynSummary', () => {
  it('keeps the rankings.json order and trims names (shortName first)', () => {
    const snap = snapshot([
      etf('069500', 60),
      etf('qqq', 90, { market: '미국', shortName: '  ', name: ' Invesco QQQ ' }),
      etf('360750', null),
      etf('1321.T', 70, { market: '일본' }),
    ]);
    const data = buildEiaynSummary(snap);
    const rankings = buildRankingsPayload(snap);

    expect(data.rankings.map((entry) => entry.code)).toEqual(
      rankings.etfs.map((entry) => entry.id.toUpperCase()),
    );
    expect(data.rankings).toEqual([
      { rank: 1, code: 'QQQ', name: 'Invesco QQQ', score: 90, market: '미국' },
      { rank: 2, code: '1321.T', name: '1321.T', score: 70, market: '일본' },
      { rank: 3, code: '069500', name: '069500', score: 60, market: '국내' },
    ]);
    expect(data.scoreModelVersion).toBe('2.0.0');
    expectSchemaShape(data);
  });

  it('normalises the universe: upper-case, sorted, unique, contract pattern only', () => {
    const snap = snapshot([etf('069500', 1)], {
      universe: ['vt', '069500', ' 069500 ', 'bad code', 'SPY'],
    });
    const data = buildEiaynSummary(snap);
    expect(data.universe).toEqual(['069500', 'SPY', 'VT']);
    expect(data.universeSize).toBe(3);
  });

  it('falls back to etfs[].id when the snapshot has no universe list', () => {
    const snap = snapshot([etf('B', 1), etf('A', 2)]);
    delete snap.universe;
    expect(buildEiaynSummary(snap).universe).toEqual(['A', 'B']);
  });

  it('caps rankings at 100 entries', () => {
    const many = Array.from({ length: 130 }, (_, index) => etf(`E${index}`, index));
    const data = buildEiaynSummary(snapshot(many));
    expect(data.rankings).toHaveLength(100);
    expect(data.rankings[0]).toMatchObject({ rank: 1, code: 'E129', score: 129 });
  });

  it('rejects a snapshot without an etfs array', () => {
    expect(() => buildEiaynSummary({ generatedAt: 'x' })).toThrow(TypeError);
  });
});

describe('buildSummaryEnvelope', () => {
  it('produces a valid v1 envelope dated by the snapshot (KST), not the run time', () => {
    const envelope = buildSummaryEnvelope(snapshot([etf('069500', 50)]));
    expect(() => validateEnvelope(envelope)).not.toThrow();
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      tool: 'eiayn',
      kind: 'summary',
      asOf: '2026-09-25T21:05:35+09:00',
      generatedAt: '2026-09-25T21:05:35+09:00',
      sources: SUMMARY_SOURCES,
    });
    expect(envelope.contentHash).toBe(contentHash(envelope.data));
  });

  it('rejects a snapshot without a valid generatedAt', () => {
    expect(() => buildSummaryEnvelope({ etfs: [] })).toThrow(TypeError);
    expect(() => buildSummaryEnvelope({ etfs: [], generatedAt: 'nope' })).toThrow(TypeError);
  });

  it('builds a valid envelope from the committed snapshot within the size budget', () => {
    const committed = JSON.parse(
      readFileSync(path.join(import.meta.dirname, '..', 'public', 'data', 'etfs.json'), 'utf8'),
    );
    const envelope = buildSummaryEnvelope(committed);
    expect(() => validateEnvelope(envelope)).not.toThrow();
    expectSchemaShape(envelope.data);
    expect(envelope.data.universeSize).toBe(committed.universe.length);
    // Contract §9: ≤ 64 KB (16 KB recommended; the full universe list is ~22 KB).
    expect(Buffer.byteLength(JSON.stringify(envelope))).toBeLessThan(64 * 1024);
  });
});

describe('publishSummary', () => {
  it('writes summary.json and version.json, then leaves them untouched when unchanged', () => {
    const dir = tempDir();
    const snap = snapshot([etf('069500', 50), etf('SPY', 60, { market: '미국' })]);

    const first = publishSummary(snap, dir);
    expect(first.summaryChanged).toBe(true);
    expect(first.versionChanged).toBe(true);
    const summaryPath = path.join(dir, 'summary.json');
    const versionPath = path.join(dir, 'version.json');
    const written = JSON.parse(readFileSync(summaryPath, 'utf8'));
    expect(() => validateEnvelope(written)).not.toThrow();
    expect(JSON.parse(readFileSync(versionPath, 'utf8'))).toEqual({
      files: { 'summary.json': written.contentHash },
      generatedAt: '2026-09-25T21:05:35+09:00',
      schemaVersion: 1,
      tool: 'eiayn',
    });

    const before = [readFileSync(summaryPath), statSync(summaryPath).mtimeMs];
    const beforeVersion = readFileSync(versionPath);
    const second = publishSummary(snap, dir);
    expect(second.summaryChanged).toBe(false);
    expect(second.versionChanged).toBe(false);
    expect(readFileSync(summaryPath).equals(before[0])).toBe(true);
    expect(statSync(summaryPath).mtimeMs).toBe(before[1]);
    expect(readFileSync(versionPath).equals(beforeVersion)).toBe(true);
  });

  it('rewrites both files when the ranking data changes', () => {
    const dir = tempDir();
    publishSummary(snapshot([etf('069500', 50)]), dir);
    const next = publishSummary(snapshot([etf('069500', 55)]), dir);
    expect(next.summaryChanged).toBe(true);
    expect(next.versionChanged).toBe(true);
    const written = JSON.parse(readFileSync(path.join(dir, 'summary.json'), 'utf8'));
    expect(written.data.rankings[0].score).toBe(55);
  });

  it('replaces a corrupt previous file instead of keeping it', () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, 'summary.json'), '{not json');
    expect(publishSummary(snapshot([etf('069500', 50)]), dir).summaryChanged).toBe(true);
  });
});
