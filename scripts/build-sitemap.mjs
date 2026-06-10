// Build-time sitemap generator (dist/sitemap.xml).
//
// buildSitemapXml(etfs, { baseUrl, generatedAt }) is a pure builder returning
// a sitemaps.org <urlset> document: the site root URL first, then one
// ?code=<id> deep link per ETF in snapshot order, every entry stamped with
// <lastmod> = the snapshot's generatedAt date (YYYY-MM-DD). ~1,349 URLs is
// far below the 50,000-URL/50MB single-sitemap limits, so one file suffices.
//
// CLI: node scripts/build-sitemap.mjs — reads public/data/etfs.json and
// writes dist/sitemap.xml. It runs after `vite build` (see the npm build
// script), so a missing dist/ is a hard error.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { escapeXml } from './data/feed.mjs';

export const SITEMAP_BASE_URL = 'https://ducklove.github.io/eiayn/';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns the sitemap.xml text for a snapshot's ETF list.
 *
 * - The bare `baseUrl` entry comes first, then `${baseUrl}?code=<id>` per
 *   ETF in snapshot order; entries without a usable string id are skipped.
 * - Every <url> carries <lastmod> = the YYYY-MM-DD date of `generatedAt`.
 * - <loc> values (including the id) are XML-escaped (& < > " ').
 * - Throws TypeError when `etfs` is not an array or `generatedAt` does not
 *   start with a YYYY-MM-DD date.
 */
export function buildSitemapXml(etfs, { baseUrl = SITEMAP_BASE_URL, generatedAt } = {}) {
  if (!Array.isArray(etfs)) {
    throw new TypeError('buildSitemapXml: etfs must be an array');
  }
  const lastmod = typeof generatedAt === 'string' ? generatedAt.slice(0, 10) : '';
  if (!DATE_PATTERN.test(lastmod)) {
    throw new TypeError('buildSitemapXml: generatedAt must start with a YYYY-MM-DD date');
  }

  const locs = [
    baseUrl,
    ...etfs
      .filter((etf) => typeof etf?.id === 'string' && etf.id !== '')
      .map((etf) => `${baseUrl}?code=${etf.id}`),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...locs.flatMap((loc) => [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '  </url>',
    ]),
    '</urlset>',
    '',
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = process.cwd();
  const DATA_FILE = path.join(ROOT, 'public', 'data', 'etfs.json');
  const DIST_DIR = path.join(ROOT, 'dist');
  const OUT_FILE = path.join(DIST_DIR, 'sitemap.xml');

  if (!existsSync(DIST_DIR)) {
    console.error(
      `[build-sitemap] ${path.relative(ROOT, DIST_DIR)}/ not found; run \`vite build\` first ` +
        '(the npm build script runs this after it)',
    );
    process.exit(1);
  }

  const payload = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  const xml = buildSitemapXml(payload.etfs, { generatedAt: payload.generatedAt });
  await writeFile(OUT_FILE, xml, 'utf8');

  const urlCount = xml.split('<url>').length - 1;
  console.log(
    `[build-sitemap] Wrote ${path.relative(ROOT, OUT_FILE)} (${urlCount} URLs, ${Buffer.byteLength(xml, 'utf8')} bytes)`,
  );
}
