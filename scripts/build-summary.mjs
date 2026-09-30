// Build-time Value Compass summary (dist/summary.json + dist/version.json).
//
// The value-invest hub reads a small envelope instead of the 9.3 MB etfs.json
// (published data contract v1: value-invest docs/ecosystem/data-contract.md
// §6.5, schema config/schemas/summary/eiayn.schema.json). The payload carries
// the covered code universe (ETF deep links / portfolio signals) and the AIYN
// TOP-N ranking in exactly the rankings.json order (the hub's daily picks).
//
// CLI: node scripts/build-summary.mjs [outDir] — reads public/data/etfs.json
// and writes <outDir>/summary.json and <outDir>/version.json (default dist/).
// It runs at the end of `npm run build`, after build-rankings.mjs. The files
// are build output (never committed); asOf and generatedAt both come from the
// snapshot's generatedAt, so the same snapshot always yields the same bytes.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRankingsPayload } from './build-rankings.mjs';
import { buildEnvelope, writeIfChanged, writeVersion } from './vc-publish.mjs';

export const TOOL_ID = 'eiayn';

export const SUMMARY_SOURCES = [
  { id: 'naver', name: '네이버 증권 ETF', url: 'https://finance.naver.com/sise/etf.naver' },
  { id: 'yahoo', name: 'Yahoo Finance', url: 'https://finance.yahoo.com/' },
  { id: 'stockanalysis', name: 'StockAnalysis', url: 'https://stockanalysis.com/etf/' },
];

const CODE_RE = /^[A-Z0-9][A-Z0-9.-]{0,29}$/;

function normalizeCode(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function trimmedOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Returns the summary `data` payload (contract §6.5) for a snapshot.
 *
 * - universe: the snapshot's covered codes (falls back to etfs[].id),
 *   upper-case, sorted, de-duplicated; codes outside the contract pattern
 *   are dropped rather than failing the build.
 * - rankings: buildRankingsPayload() order (rank ascending, ≤100 entries).
 *   `name` is the trimmed shortName, else name. Missing scores stay null.
 */
export function buildEiaynSummary(snapshot, rankingsPayload = buildRankingsPayload(snapshot)) {
  if (!Array.isArray(snapshot?.etfs)) {
    throw new TypeError('buildEiaynSummary: snapshot.etfs must be an array');
  }
  const rawUniverse = Array.isArray(snapshot.universe)
    ? snapshot.universe
    : snapshot.etfs.map((etf) => etf.id);
  const universe = [...new Set(rawUniverse.map(normalizeCode))]
    .filter((code) => CODE_RE.test(code))
    .sort();

  const rankings = (rankingsPayload?.etfs ?? [])
    .map((entry) => ({
      rank: entry.rank,
      code: normalizeCode(entry.id ?? entry.ticker),
      name: trimmedOrNull(entry.shortName) ?? trimmedOrNull(entry.name),
      score: finiteOrNull(entry.aiynScore),
      market: trimmedOrNull(entry.market),
    }))
    .filter((entry) => CODE_RE.test(entry.code))
    .slice(0, 100);

  return {
    scoreModelVersion:
      trimmedOrNull(rankingsPayload?.scoreModelVersion) ??
      trimmedOrNull(snapshot.scoreModelVersion),
    universeSize: universe.length,
    universe,
    rankings,
  };
}

/** Builds the validated envelope; asOf/generatedAt = snapshot.generatedAt (KST). */
export function buildSummaryEnvelope(snapshot) {
  if (typeof snapshot?.generatedAt !== 'string' || !snapshot.generatedAt) {
    throw new TypeError('buildSummaryEnvelope: snapshot.generatedAt must be a string');
  }
  const stamp = new Date(snapshot.generatedAt);
  if (Number.isNaN(stamp.getTime())) {
    throw new TypeError(`buildSummaryEnvelope: invalid generatedAt ${snapshot.generatedAt}`);
  }
  return buildEnvelope(TOOL_ID, buildEiaynSummary(snapshot), {
    asOf: stamp,
    generatedAt: stamp,
    sources: SUMMARY_SOURCES,
  });
}

/**
 * Writes <outDir>/summary.json and <outDir>/version.json. Each file is only
 * rewritten when its content changed (vc-publish no-op rule).
 */
export function publishSummary(snapshot, outDir) {
  const envelope = buildSummaryEnvelope(snapshot);
  const summaryChanged = writeIfChanged(path.join(outDir, 'summary.json'), envelope);
  const versionChanged = writeVersion(
    path.join(outDir, 'version.json'),
    { 'summary.json': envelope },
    { generatedAt: envelope.generatedAt },
  );
  return { envelope, summaryChanged, versionChanged };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = process.cwd();
  const DATA_FILE = path.join(ROOT, 'public', 'data', 'etfs.json');
  const OUT_DIR = path.resolve(ROOT, process.argv[2] ?? 'dist');

  if (!existsSync(OUT_DIR)) {
    console.error(
      `[build-summary] ${path.relative(ROOT, OUT_DIR)}/ not found; run \`vite build\` first ` +
        '(the npm build script runs this after it)',
    );
    process.exit(1);
  }

  const snapshot = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  const { envelope, summaryChanged } = publishSummary(snapshot, OUT_DIR);
  const bytes = Buffer.byteLength(readFileSync(path.join(OUT_DIR, 'summary.json')));
  console.log(
    `[build-summary] ${summaryChanged ? 'Wrote' : 'Unchanged'} ` +
      `${path.relative(ROOT, path.join(OUT_DIR, 'summary.json'))} (${envelope.data.universeSize} codes, ` +
      `top ${envelope.data.rankings.length}, asOf ${envelope.asOf}, ${bytes} bytes)`,
  );
}
