import { describe, expect, it } from 'vitest';
import { buildSourceCatalog, migrateSnapshotToV2 } from './source-catalog.mjs';

const KETF_LINEUP = {
  name: 'K-ETF active ETF lineup',
  url: 'https://anchor.k-etf.com/api/instrument/instruments/',
  fields: ['active ETF lineup', 'name'],
};
const KETF_QUOTES = {
  name: 'K-ETF instrument return',
  url: 'https://anchor.k-etf.com/api/timeseries/instrument-return/',
  fields: ['price', 'aum'],
};
const YAHOO_CHART_QQQ = {
  name: 'Yahoo Finance chart',
  url: 'https://query1.finance.yahoo.com/v8/finance/chart/QQQ',
  fields: ['price', 'history'],
};

function makeEtf(id, sources) {
  return {
    id,
    ticker: id,
    name: `${id} fund`,
    returns: { m3: 1.5, y1: null },
    holdings: [{ name: 'Top holding', ticker: null, weight: 9.9 }],
    dataQuality: {
      quoteAsOf: '2026-06-05T02:30:00Z',
      profileAsOf: '2026-06-04T00:00:00.000Z',
      holdingsAsOf: null,
      sources,
      missingFields: ['expenseRatio'],
    },
  };
}

describe('buildSourceCatalog', () => {
  it('dedupes identical sources into one catalog entry shared by reference index', () => {
    const { catalog, etfsWithRefs } = buildSourceCatalog([
      makeEtf('069500', [KETF_LINEUP, KETF_QUOTES]),
      makeEtf('360750', [KETF_LINEUP, KETF_QUOTES]),
    ]);

    expect(catalog).toEqual([KETF_LINEUP, KETF_QUOTES]);
    expect(etfsWithRefs[0].dataQuality.sourceRefs).toEqual([0, 1]);
    expect(etfsWithRefs[1].dataQuality.sourceRefs).toEqual([0, 1]);
  });

  it('assigns order-stable indexes in first-seen order across ETFs', () => {
    const { catalog, etfsWithRefs } = buildSourceCatalog([
      makeEtf('069500', [KETF_LINEUP]),
      makeEtf('QQQ', [YAHOO_CHART_QQQ, KETF_LINEUP]),
      makeEtf('360750', [KETF_QUOTES]),
    ]);

    expect(catalog).toEqual([KETF_LINEUP, YAHOO_CHART_QQQ, KETF_QUOTES]);
    expect(etfsWithRefs.map((etf) => etf.dataQuality.sourceRefs)).toEqual([[0], [1, 0], [2]]);
  });

  it('treats fields order as significant when deduping', () => {
    const reordered = { ...KETF_LINEUP, fields: [...KETF_LINEUP.fields].reverse() };
    const { catalog, etfsWithRefs } = buildSourceCatalog([
      makeEtf('A', [KETF_LINEUP]),
      makeEtf('B', [reordered]),
    ]);

    expect(catalog).toEqual([KETF_LINEUP, reordered]);
    expect(etfsWithRefs[1].dataQuality.sourceRefs).toEqual([1]);
  });

  it('defaults missing fields arrays to [] and dedupes them with explicit empty arrays', () => {
    const noFields = { name: 'JPX ETF profile', url: 'https://www.jpx.co.jp/' };
    const emptyFields = { ...noFields, fields: [] };
    const { catalog, etfsWithRefs } = buildSourceCatalog([
      makeEtf('1306.T', [noFields]),
      makeEtf('1321.T', [emptyFields]),
    ]);

    expect(catalog).toEqual([{ name: noFields.name, url: noFields.url, fields: [] }]);
    expect(etfsWithRefs.map((etf) => etf.dataQuality.sourceRefs)).toEqual([[0], [0]]);
  });

  it('maps ETFs with zero sources to an empty refs array without throwing', () => {
    const { catalog, etfsWithRefs } = buildSourceCatalog([
      makeEtf('EMPTY', []),
      { id: 'NOSRC', dataQuality: { quoteAsOf: '2026-06-05T02:30:00Z' } },
    ]);

    expect(catalog).toEqual([]);
    expect(etfsWithRefs[0].dataQuality.sourceRefs).toEqual([]);
    expect(etfsWithRefs[1].dataQuality.sourceRefs).toEqual([]);
  });

  it('returns ETFs without a dataQuality object unchanged', () => {
    const bare = { id: 'BARE', ticker: 'BARE' };
    const { catalog, etfsWithRefs } = buildSourceCatalog([bare]);

    expect(catalog).toEqual([]);
    expect(etfsWithRefs[0]).toBe(bare);
  });

  it('replaces sources in place, preserving every other dataQuality key and its position', () => {
    const etf = makeEtf('069500', [KETF_LINEUP]);
    const { etfsWithRefs } = buildSourceCatalog([etf]);
    const dataQuality = etfsWithRefs[0].dataQuality;

    expect(Object.keys(dataQuality)).toEqual([
      'quoteAsOf',
      'profileAsOf',
      'holdingsAsOf',
      'sourceRefs',
      'missingFields',
    ]);
    expect(dataQuality.quoteAsOf).toBe(etf.dataQuality.quoteAsOf);
    expect(dataQuality.profileAsOf).toBe(etf.dataQuality.profileAsOf);
    expect(dataQuality.holdingsAsOf).toBeNull();
    expect(dataQuality.missingFields).toEqual(['expenseRatio']);
  });

  it('does not mutate the input ETFs', () => {
    const etfs = [makeEtf('069500', [KETF_LINEUP])];
    const before = JSON.parse(JSON.stringify(etfs));
    buildSourceCatalog(etfs);
    expect(etfs).toEqual(before);
  });
});

describe('migrateSnapshotToV2', () => {
  function makeV1Payload() {
    return {
      generatedAt: '2026-06-05T02:32:08.842Z',
      timezone: 'Asia/Seoul',
      universe: ['069500', 'QQQ'],
      coverage: { korea: { included: 1 } },
      sources: [{ name: 'K-ETF', url: 'https://www.k-etf.com/', fields: ['lineup'] }],
      exchangeRates: { usdKrw: 1378.1 },
      etfs: [makeEtf('069500', [KETF_LINEUP, KETF_QUOTES]), makeEtf('QQQ', [YAHOO_CHART_QQQ])],
    };
  }

  it('transforms a v1 payload to schema v2 with a catalog and per-ETF refs', () => {
    const { migrated, payload } = migrateSnapshotToV2(makeV1Payload());

    expect(migrated).toBe(true);
    expect(payload.schemaVersion).toBe(2);
    expect(payload.sourceCatalog).toEqual([KETF_LINEUP, KETF_QUOTES, YAHOO_CHART_QQQ]);
    expect(payload.etfs[0].dataQuality.sourceRefs).toEqual([0, 1]);
    expect(payload.etfs[1].dataQuality.sourceRefs).toEqual([2]);
    expect(payload.etfs.some((etf) => 'sources' in etf.dataQuality)).toBe(false);
  });

  it('puts schemaVersion first and sourceCatalog right after the top-level sources array', () => {
    const { payload } = migrateSnapshotToV2(makeV1Payload());
    expect(Object.keys(payload)).toEqual([
      'schemaVersion',
      'generatedAt',
      'timezone',
      'universe',
      'coverage',
      'sources',
      'sourceCatalog',
      'exchangeRates',
      'etfs',
    ]);
  });

  it('does not touch any field other than schemaVersion, sourceCatalog and dataQuality.sources', () => {
    const original = makeV1Payload();
    const reference = JSON.parse(JSON.stringify(original));
    const { payload } = migrateSnapshotToV2(original);

    // Input payload is left unmutated.
    expect(original).toEqual(reference);

    // Everything except the migrated fields is deep-equal to the v1 input.
    const strippedResult = JSON.parse(JSON.stringify(payload));
    delete strippedResult.schemaVersion;
    delete strippedResult.sourceCatalog;
    const strippedReference = JSON.parse(JSON.stringify(reference));
    for (const [index, etf] of strippedReference.etfs.entries()) {
      etf.dataQuality.sourceRefs = strippedResult.etfs[index].dataQuality.sourceRefs;
      delete etf.dataQuality.sources;
    }
    expect(strippedResult).toEqual(strippedReference);
  });

  it('is idempotent: a v2 payload is returned untouched', () => {
    const first = migrateSnapshotToV2(makeV1Payload());
    const second = migrateSnapshotToV2(first.payload);

    expect(second.migrated).toBe(false);
    expect(second.payload).toBe(first.payload);
    expect(JSON.stringify(second.payload)).toBe(JSON.stringify(first.payload));
  });
});
