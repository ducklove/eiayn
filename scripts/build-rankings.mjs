// Build-time AIYN ranking API (dist/data/rankings.json).
//
// buildRankingsPayload(snapshot, options) is a pure builder returning a
// machine-readable top-N ranking of the snapshot by AIYN score, using the
// exact same ordering as the AIYN 랭킹 view (src/lib/ranking.js). The file
// is a static "API" for external consumers, served from GitHub Pages at
// <baseUrl>data/rankings.json next to etfs.json.
//
// CLI: node scripts/build-rankings.mjs — reads public/data/etfs.json and
// writes dist/data/rankings.json. It runs after `vite build` (see the npm
// build script), so a missing dist/ is a hard error.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_RANKING_LIMIT, rankEtfsByScore } from '../src/lib/ranking.js';
import { SITEMAP_BASE_URL } from './build-sitemap.mjs';

/**
 * Returns the rankings.json payload for a snapshot.
 *
 * - Ranks by AIYN score descending (null scores excluded), the shared
 *   src/lib/ranking.js order, truncated to `limit` (default 100).
 * - Each entry carries rank (1-based), identity fields, the score with its
 *   data coverage, headline metrics, and a `link` deep link to the
 *   analysis view. Missing metrics stay null — never estimated.
 * - Throws TypeError when the snapshot has no etfs array or generatedAt.
 */
export function buildRankingsPayload(
  snapshot,
  { limit = DEFAULT_RANKING_LIMIT, baseUrl = SITEMAP_BASE_URL } = {},
) {
  if (!Array.isArray(snapshot?.etfs)) {
    throw new TypeError('buildRankingsPayload: snapshot.etfs must be an array');
  }
  if (typeof snapshot.generatedAt !== 'string' || !snapshot.generatedAt) {
    throw new TypeError('buildRankingsPayload: snapshot.generatedAt must be a string');
  }

  const ranked = rankEtfsByScore(snapshot.etfs, { limit });

  return {
    generatedAt: snapshot.generatedAt,
    criteria:
      'aiynScore descending; ETFs without a score are excluded; ties break by scoreCoverage, then AUM, then id',
    universeSize: snapshot.etfs.length,
    count: ranked.length,
    etfs: ranked.map((etf, index) => ({
      rank: index + 1,
      id: etf.id,
      ticker: etf.ticker ?? null,
      name: etf.name ?? null,
      shortName: etf.shortName ?? null,
      market: etf.market ?? null,
      currency: etf.currency ?? null,
      provider: etf.provider ?? null,
      aiynScore: etf.aiynScore,
      scoreCoverage: etf.scoreCoverage ?? null,
      expenseRatio: etf.expenseRatio ?? null,
      dividendYield: etf.dividendYield ?? null,
      return1y: etf.returns?.y1 ?? null,
      aum: etf.aum ?? null,
      link: `${baseUrl}?code=${encodeURIComponent(etf.id)}`,
    })),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = process.cwd();
  const DATA_FILE = path.join(ROOT, 'public', 'data', 'etfs.json');
  const DIST_DIR = path.join(ROOT, 'dist');
  const OUT_FILE = path.join(DIST_DIR, 'data', 'rankings.json');

  if (!existsSync(DIST_DIR)) {
    console.error(
      `[build-rankings] ${path.relative(ROOT, DIST_DIR)}/ not found; run \`vite build\` first ` +
        '(the npm build script runs this after it)',
    );
    process.exit(1);
  }

  const snapshot = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  const payload = buildRankingsPayload(snapshot);
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(OUT_FILE, json, 'utf8');

  console.log(
    `[build-rankings] Wrote ${path.relative(ROOT, OUT_FILE)} (top ${payload.count} of ` +
      `${payload.universeSize} ETFs, ${Buffer.byteLength(json, 'utf8')} bytes)`,
  );
}
