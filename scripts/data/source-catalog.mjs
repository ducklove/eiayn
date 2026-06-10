// Schema v2 source catalog.
//
// In schema v1 every ETF carried its own `dataQuality.sources` array of
// { name, url, fields } attribution objects. Most of those objects are
// identical across ETFs (the shared K-ETF endpoints alone repeat ~1,100
// times each), which made the snapshot ~30% bigger than it needs to be.
// Schema v2 stores each distinct source once in a top-level `sourceCatalog`
// and replaces the per-ETF arrays with `dataQuality.sourceRefs`: integer
// indexes into that catalog.
//
// The pipeline's per-ETF code keeps producing inline source objects; the
// catalog pass runs once at the end, right before the payload is written.

function normalizeSource(source) {
  return {
    name: source.name,
    url: source.url,
    // `fields` order is significant attribution metadata, so it is kept
    // as-is (never sorted) and only defaulted when missing.
    fields: Array.isArray(source.fields) ? source.fields : [],
  };
}

function sourceKey(source) {
  return JSON.stringify([source.name, source.url, source.fields]);
}

function withSourceRefs(dataQuality, sourceRefs) {
  const next = {};
  let replaced = false;
  for (const [key, value] of Object.entries(dataQuality)) {
    if (key === 'sources') {
      next.sourceRefs = sourceRefs;
      replaced = true;
    } else {
      next[key] = value;
    }
  }
  if (!replaced) next.sourceRefs = sourceRefs;
  return next;
}

/**
 * Build a deduplicated source catalog from per-ETF `dataQuality.sources`.
 *
 * Returns `{ catalog, etfsWithRefs }` where `catalog` lists each distinct
 * source once (dedupe key: name + url + fields, fields order significant)
 * in first-seen order, and `etfsWithRefs` mirrors `etfs` with each
 * `dataQuality.sources` array replaced in place by `dataQuality.sourceRefs`
 * (indexes into `catalog`). Every other field is passed through untouched.
 * ETFs with zero sources get an empty refs array; ETFs without a
 * `dataQuality` object are returned unchanged.
 */
export function buildSourceCatalog(etfs) {
  const catalog = [];
  const indexByKey = new Map();

  const etfsWithRefs = etfs.map((etf) => {
    if (!etf?.dataQuality) return etf;

    const sources = Array.isArray(etf.dataQuality.sources) ? etf.dataQuality.sources : [];
    const sourceRefs = sources.filter(Boolean).map((rawSource) => {
      const source = normalizeSource(rawSource);
      const key = sourceKey(source);
      let index = indexByKey.get(key);
      if (index === undefined) {
        index = catalog.length;
        indexByKey.set(key, index);
        catalog.push(source);
      }
      return index;
    });

    return { ...etf, dataQuality: withSourceRefs(etf.dataQuality, sourceRefs) };
  });

  return { catalog, etfsWithRefs };
}

/**
 * Migrate a full snapshot payload from schema v1 to schema v2.
 *
 * Returns `{ migrated, payload }`. A payload already at `schemaVersion: 2`
 * is returned untouched with `migrated: false`, so the transform is
 * idempotent. For v1 payloads the result adds `schemaVersion: 2` first,
 * inserts `sourceCatalog` right after the human-readable top-level
 * `sources` array, and rewrites `etfs` via {@link buildSourceCatalog};
 * every other top-level key keeps its value and position.
 */
export function migrateSnapshotToV2(payload) {
  if (payload?.schemaVersion === 2) return { migrated: false, payload };

  const { catalog, etfsWithRefs } = buildSourceCatalog(payload.etfs ?? []);
  const next = { schemaVersion: 2 };
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'schemaVersion') continue;
    next[key] = key === 'etfs' ? etfsWithRefs : value;
    if (key === 'sources') next.sourceCatalog = catalog;
  }
  if (!Object.hasOwn(next, 'sourceCatalog')) next.sourceCatalog = catalog;

  return { migrated: true, payload: next };
}
