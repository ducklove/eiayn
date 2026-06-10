// One-time migration of the committed snapshot from schema v1 to schema v2.
//
// Usage: node scripts/migrate-snapshot.mjs
//
// Reads public/data/etfs.json; if it is schema v1 (per-ETF
// dataQuality.sources, no schemaVersion) it is rewritten as schema v2 with a
// deduplicated top-level sourceCatalog and per-ETF dataQuality.sourceRefs,
// using the same pure transform as the data pipeline. Idempotent: a file
// already at schemaVersion 2 is left untouched and the script exits 0.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { migrateSnapshotToV2 } from './data/source-catalog.mjs';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'public', 'data', 'etfs.json');

const raw = await readFile(DATA_FILE, 'utf8');
const payload = JSON.parse(raw);

const { migrated, payload: next } = migrateSnapshotToV2(payload);
if (!migrated) {
  console.log(`[migrate-snapshot] ${path.relative(ROOT, DATA_FILE)} is already schema v2; no-op`);
  process.exit(0);
}

// Match the pipeline's serialization exactly: 2-space indent + trailing newline.
await writeFile(DATA_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
console.log(
  `[migrate-snapshot] migrated ${path.relative(ROOT, DATA_FILE)} to schema v2: ` +
    `${next.etfs.length} ETFs, ${next.sourceCatalog.length} catalog entries`,
);
