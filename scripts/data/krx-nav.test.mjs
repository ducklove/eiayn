import { describe, expect, it } from 'vitest';
import {
  applyKrxNavEnrichment,
  fetchKrxNav,
  KRX_NAV_BLD,
  KRX_NAV_ENDPOINT,
  KRX_NAV_MAX_ATTEMPTS,
  KRX_NAV_REFERER,
  KRX_NAV_SOURCE_NAME,
  KRX_NAV_SOURCE_URL,
  krxNavSourceEntry,
  parseKrxNavRows,
  parseKrxNumber,
  seoulDateString,
} from './krx-nav.mjs';

// 12:00 KST on 2026-06-10 (a Wednesday).
const NOW = new Date('2026-06-10T03:00:00Z');

// Realistic MDCSTAT04301 rows: comma-formatted numeric strings, "-" for
// missing values, plus columns the parser must ignore.
function krxDayFixture() {
  return {
    OutBlock_1: [
      {
        ISU_SRT_CD: '069500',
        ISU_ABBRV: 'KODEX 200',
        TDD_CLSPRC: '10,250',
        FLUC_TP_CD: '1',
        CMPPREVDD_PRC: '305',
        FLUC_RT: '0.84',
        NAV: '10,000.00',
        TDD_OPNPRC: '10,180',
        ACC_TRDVOL: '5,012,345',
        INVSTASST_NETASST_TOTAMT: '6,128,000,000,000',
      },
      {
        ISU_SRT_CD: '122630',
        ISU_ABBRV: 'KODEX 레버리지',
        TDD_CLSPRC: '9,900',
        NAV: '10,000',
      },
    ],
    CURRENT_DATETIME: '2026.06.10 PM 04:30:18',
  };
}

const EMPTY_DAY = { output: [], CURRENT_DATETIME: '2026.06.10 AM 08:00:00' };

function jsonResponse(body) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body };
}

// Call-recording fetch stub. `responder` is either an array of per-call
// results or a function of the recorded call; an Error result is thrown.
function recordingFetch(responder) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const call = { url, options, params: new URLSearchParams(options.body) };
    calls.push(call);
    const result = Array.isArray(responder) ? responder[calls.length - 1] : responder(call);
    if (result instanceof Error) throw result;
    return result;
  };
  return { calls, fetchImpl };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

function makeEtf(overrides = {}) {
  return {
    id: '069500',
    ticker: '069500',
    name: 'KODEX 200',
    market: '국내',
    price: 10250,
    nav: null,
    dataQuality: {
      quoteAsOf: '2026-06-10T07:00:00.000Z',
      sources: [{ name: 'K-ETF', url: 'https://www.k-etf.com/', fields: ['price'] }],
      missingFields: [],
    },
    ...overrides,
  };
}

describe('parseKrxNumber', () => {
  it('parses comma-formatted KRX strings and plain numbers', () => {
    expect(parseKrxNumber('10,123.45')).toBe(10123.45);
    expect(parseKrxNumber('1,234')).toBe(1234);
    expect(parseKrxNumber(' 36,815 ')).toBe(36815);
    expect(parseKrxNumber('-0.5')).toBe(-0.5);
    expect(parseKrxNumber('0')).toBe(0);
    expect(parseKrxNumber(9875)).toBe(9875);
  });

  it('returns null for missing markers and unparseable values', () => {
    expect(parseKrxNumber('-')).toBeNull();
    expect(parseKrxNumber('')).toBeNull();
    expect(parseKrxNumber('  ')).toBeNull();
    expect(parseKrxNumber('n/a')).toBeNull();
    expect(parseKrxNumber('12.34.56')).toBeNull();
    expect(parseKrxNumber('1e5')).toBeNull();
    expect(parseKrxNumber(null)).toBeNull();
    expect(parseKrxNumber(undefined)).toBeNull();
    expect(parseKrxNumber(Number.NaN)).toBeNull();
    expect(parseKrxNumber(Infinity)).toBeNull();
    expect(parseKrxNumber({})).toBeNull();
  });
});

describe('parseKrxNavRows', () => {
  it('maps 6-digit codes to nav, close, and the rounded premium/discount', () => {
    const map = parseKrxNavRows(krxDayFixture());
    expect(map.size).toBe(2);
    // (10,250 - 10,000) / 10,000 * 100 = 2.5% premium.
    expect(map.get('069500')).toEqual({ nav: 10000, close: 10250, premiumDiscount: 2.5 });
    // (9,900 - 10,000) / 10,000 * 100 = -1% discount.
    expect(map.get('122630')).toEqual({ nav: 10000, close: 9900, premiumDiscount: -1 });
  });

  it('rounds the premium/discount to 2 decimals', () => {
    const map = parseKrxNavRows({
      output: [
        // (101 - 99) / 99 * 100 = 2.0202... -> 2.02
        { ISU_SRT_CD: '459580', TDD_CLSPRC: '101', NAV: '99' },
        // (36,815 - 36,741.21) / 36,741.21 * 100 = 0.20084... -> 0.2
        { ISU_SRT_CD: '360750', TDD_CLSPRC: '36,815', NAV: '36,741.21' },
      ],
    });
    expect(map.get('459580')).toEqual({ nav: 99, close: 101, premiumDiscount: 2.02 });
    expect(map.get('360750')).toEqual({ nav: 36741.21, close: 36815, premiumDiscount: 0.2 });
  });

  it('skips rows with "-", empty, missing, or non-positive close/NAV', () => {
    const map = parseKrxNavRows({
      output: [
        { ISU_SRT_CD: '100001', TDD_CLSPRC: '10,000', NAV: '-' },
        { ISU_SRT_CD: '100002', TDD_CLSPRC: '', NAV: '10,000' },
        { ISU_SRT_CD: '100003', NAV: '10,000' },
        { ISU_SRT_CD: '100004', TDD_CLSPRC: '10,000' },
        { ISU_SRT_CD: '100005', TDD_CLSPRC: '10,000', NAV: '0' },
        { ISU_SRT_CD: '100006', TDD_CLSPRC: '10,000', NAV: '-1,000' },
        { ISU_SRT_CD: '100007', TDD_CLSPRC: '0', NAV: '10,000' },
        { ISU_SRT_CD: '100008', TDD_CLSPRC: 'n/a', NAV: '10,000' },
        { ISU_SRT_CD: '100009', TDD_CLSPRC: '10,100', NAV: '10,000' },
      ],
    });
    expect([...map.keys()]).toEqual(['100009']);
    expect(map.get('100009').premiumDiscount).toBe(1);
  });

  it('skips rows without a clean 6-digit code and trims whitespace', () => {
    const map = parseKrxNavRows({
      output: [
        { ISU_SRT_CD: ' 459580 ', TDD_CLSPRC: '101', NAV: '99' },
        { ISU_SRT_CD: '69500', TDD_CLSPRC: '101', NAV: '99' },
        { ISU_SRT_CD: 'KR7069500007', TDD_CLSPRC: '101', NAV: '99' },
        { ISU_SRT_CD: '', TDD_CLSPRC: '101', NAV: '99' },
        { TDD_CLSPRC: '101', NAV: '99' },
      ],
    });
    expect([...map.keys()]).toEqual(['459580']);
  });

  it('detects the payload array generically, regardless of its property name', () => {
    const row = { ISU_SRT_CD: '069500', TDD_CLSPRC: '101', NAV: '100' };
    expect(parseKrxNavRows({ output: [row] }).size).toBe(1);
    expect(parseKrxNavRows({ OutBlock_1: [row] }).size).toBe(1);
    expect(parseKrxNavRows({ block9: [row], CURRENT_DATETIME: 'x' }).size).toBe(1);
  });

  it('skips non-matching array properties when locating the payload', () => {
    const row = { ISU_SRT_CD: '069500', TDD_CLSPRC: '101', NAV: '100' };
    const map = parseKrxNavRows({
      CURRENT_DATETIME: '2026.06.10',
      chartData: [{ trdDd: '20260610', value: 1 }],
      labels: ['a', 'b'],
      empty: [],
      output: [row],
    });
    expect(map.size).toBe(1);
    expect(map.get('069500')).toBeDefined();
  });

  it('returns an empty map for holiday/blocked/malformed responses', () => {
    expect(parseKrxNavRows(EMPTY_DAY).size).toBe(0);
    expect(parseKrxNavRows({}).size).toBe(0);
    expect(parseKrxNavRows(null).size).toBe(0);
    expect(parseKrxNavRows(undefined).size).toBe(0);
    expect(parseKrxNavRows('not json').size).toBe(0);
    expect(parseKrxNavRows([{ ISU_SRT_CD: '069500' }]).size).toBe(0);
    expect(parseKrxNavRows({ output: [null, { ISU_SRT_CD: '069500' }] }).size).toBe(0);
  });
});

describe('applyKrxNavEnrichment', () => {
  const navMap = new Map([['069500', { nav: 10000, close: 10250, premiumDiscount: 2.5 }]]);

  it('fills nav and premiumDiscount on matched Korean ETFs with attribution', () => {
    const etf = makeEtf();
    const [result] = applyKrxNavEnrichment([etf], navMap, { tradeDate: '2026-06-10' });

    expect(result.nav).toBe(10000);
    expect(result.premiumDiscount).toBe(2.5);
    expect(result.dataQuality.navAsOf).toBe('2026-06-10');
    expect(result.dataQuality.sources).toEqual([
      { name: 'K-ETF', url: 'https://www.k-etf.com/', fields: ['price'] },
      { name: KRX_NAV_SOURCE_NAME, url: KRX_NAV_SOURCE_URL, fields: ['nav', 'premiumDiscount'] },
    ]);
    // Untouched fields pass through.
    expect(result.price).toBe(10250);
    expect(result.dataQuality.quoteAsOf).toBe('2026-06-10T07:00:00.000Z');
  });

  it('keeps an existing nav (fill-only-null) and attributes only premiumDiscount', () => {
    const etf = makeEtf({ nav: 10123 });
    const [result] = applyKrxNavEnrichment([etf], navMap, { tradeDate: '2026-06-10' });

    expect(result.nav).toBe(10123);
    expect(result.premiumDiscount).toBe(2.5);
    expect(result.dataQuality.sources.at(-1)).toEqual(krxNavSourceEntry(['premiumDiscount']));
  });

  it('adds premiumDiscount: null to unmatched Korean ETFs without attribution', () => {
    const etf = makeEtf({ id: '999999', ticker: '999999' });
    const [result] = applyKrxNavEnrichment([etf], navMap, { tradeDate: '2026-06-10' });

    expect(result.premiumDiscount).toBeNull();
    expect(result.nav).toBeNull();
    expect(result.dataQuality.sources).toHaveLength(1);
    expect(result.dataQuality.navAsOf).toBeUndefined();
  });

  it('leaves non-Korean ETFs untouched except premiumDiscount: null, even on a ticker collision', () => {
    const etf = makeEtf({ market: '미국' });
    const [result] = applyKrxNavEnrichment([etf], navMap, { tradeDate: '2026-06-10' });

    expect(result.premiumDiscount).toBeNull();
    expect(result.nav).toBeNull();
    expect(result.dataQuality).toEqual(etf.dataQuality);
  });

  it('adds premiumDiscount: null snapshot-wide when the map is empty (KRX unavailable)', () => {
    const etfs = [makeEtf(), makeEtf({ id: 'QQQ', ticker: 'QQQ', market: '미국' })];
    const result = applyKrxNavEnrichment(etfs, new Map(), { tradeDate: null });

    expect(result).toHaveLength(2);
    for (const etf of result) {
      expect(etf).toHaveProperty('premiumDiscount', null);
      expect(etf.nav).toBeNull();
      expect(etf.dataQuality.sources).toHaveLength(1);
    }
  });

  it('omits navAsOf when no tradeDate is provided', () => {
    const [result] = applyKrxNavEnrichment([makeEtf()], navMap);
    expect(result.nav).toBe(10000);
    expect(Object.hasOwn(result.dataQuality, 'navAsOf')).toBe(false);
  });

  it('preserves a pre-existing premiumDiscount (idempotent re-application)', () => {
    const matched = makeEtf({ nav: 10100, premiumDiscount: 1.23 });
    const unmatched = makeEtf({ id: '999999', ticker: '999999', premiumDiscount: 4.56 });
    const [first, second] = applyKrxNavEnrichment([matched, unmatched], navMap, {
      tradeDate: '2026-06-10',
    });

    expect(first.premiumDiscount).toBe(1.23);
    expect(first.nav).toBe(10100);
    // Nothing filled: no source entry, no navAsOf.
    expect(first.dataQuality).toEqual(matched.dataQuality);
    expect(second.premiumDiscount).toBe(4.56);
  });

  it('never mutates its inputs and returns a new array', () => {
    const etfs = deepFreeze([makeEtf(), makeEtf({ id: 'QQQ', ticker: 'QQQ', market: '미국' })]);
    const frozenMap = new Map([
      ['069500', deepFreeze({ nav: 10000, close: 10250, premiumDiscount: 2.5 })],
    ]);

    const result = applyKrxNavEnrichment(etfs, frozenMap, { tradeDate: '2026-06-10' });

    expect(result).not.toBe(etfs);
    expect(result[0]).not.toBe(etfs[0]);
    expect(etfs[0].nav).toBeNull();
    expect(Object.hasOwn(etfs[0], 'premiumDiscount')).toBe(false);
    expect(etfs[0].dataQuality.sources).toHaveLength(1);
    expect(result[0].nav).toBe(10000);
  });
});

describe('seoulDateString', () => {
  it('converts instants to the Asia/Seoul calendar date (UTC+9)', () => {
    expect(seoulDateString(new Date('2026-06-10T03:00:00Z'))).toBe('2026-06-10');
    expect(seoulDateString(new Date('2026-06-09T15:00:00Z'))).toBe('2026-06-10');
    expect(seoulDateString(new Date('2026-06-09T14:59:59Z'))).toBe('2026-06-09');
    expect(seoulDateString(new Date('2025-12-31T16:00:00Z'))).toBe('2026-01-01');
  });
});

describe('fetchKrxNav', () => {
  it("requests today's Seoul trading day with the documented form params and headers", async () => {
    const { calls, fetchImpl } = recordingFetch([jsonResponse(krxDayFixture())]);

    const result = await fetchKrxNav({ fetchImpl, now: NOW });

    expect(result.trdDd).toBe('20260610');
    expect(result.tradeDate).toBe('2026-06-10');
    expect(result.navMap.get('069500')).toEqual({
      nav: 10000,
      close: 10250,
      premiumDiscount: 2.5,
    });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.url).toBe(KRX_NAV_ENDPOINT);
    expect(call.options.method).toBe('POST');
    expect(call.options.headers.referer).toBe(KRX_NAV_REFERER);
    expect(call.options.headers['content-type']).toContain('application/x-www-form-urlencoded');
    expect(call.options.signal).toBeInstanceOf(AbortSignal);
    expect(Object.fromEntries(call.params)).toEqual({
      bld: KRX_NAV_BLD,
      locale: 'ko_KR',
      trdDd: '20260610',
      share: '1',
      money: '1',
      csvxls_isNo: 'false',
    });
  });

  it('uses the Asia/Seoul calendar date, not the UTC date', async () => {
    // 01:30 KST on 2026-06-10 is still 2026-06-09 in UTC.
    const { calls, fetchImpl } = recordingFetch([jsonResponse(krxDayFixture())]);
    await fetchKrxNav({ fetchImpl, now: new Date('2026-06-09T16:30:00Z') });
    expect(calls[0].params.get('trdDd')).toBe('20260610');
  });

  it('walks back one calendar day at a time across empty (holiday) responses', async () => {
    const { calls, fetchImpl } = recordingFetch([
      jsonResponse(EMPTY_DAY),
      jsonResponse(EMPTY_DAY),
      jsonResponse(krxDayFixture()),
    ]);

    const result = await fetchKrxNav({ fetchImpl, now: NOW });

    expect(calls.map((call) => call.params.get('trdDd'))).toEqual([
      '20260610',
      '20260609',
      '20260608',
    ]);
    expect(result.trdDd).toBe('20260608');
    expect(result.tradeDate).toBe('2026-06-08');
    expect(result.navMap.size).toBe(2);
  });

  it('also walks back over HTTP errors and unparseable bodies', async () => {
    const { calls, fetchImpl } = recordingFetch([
      { ok: false, status: 403, statusText: 'Forbidden', json: async () => ({}) },
      {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => {
          throw new Error('unexpected token');
        },
      },
      jsonResponse(krxDayFixture()),
    ]);

    const result = await fetchKrxNav({ fetchImpl, now: NOW });

    expect(calls).toHaveLength(3);
    expect(result.trdDd).toBe('20260608');
  });

  it(`throws a descriptive error after ${KRX_NAV_MAX_ATTEMPTS} attempts, crossing month boundaries`, async () => {
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(EMPTY_DAY));

    await expect(fetchKrxNav({ fetchImpl, now: new Date('2026-06-03T03:00:00Z') })).rejects.toThrow(
      `KRX NAV endpoint returned no usable data after ${KRX_NAV_MAX_ATTEMPTS} attempts ` +
        '(trdDd 20260528..20260603; last failure: no parseable rows for trdDd=20260528)',
    );

    expect(calls.map((call) => call.params.get('trdDd'))).toEqual([
      '20260603',
      '20260602',
      '20260601',
      '20260531',
      '20260530',
      '20260529',
      '20260528',
    ]);
  });

  it('aborts hung requests via the per-request timeout and reports the failure', async () => {
    const fetchImpl = (url, options) =>
      new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted by signal')));
      });

    await expect(fetchKrxNav({ fetchImpl, now: NOW, timeoutMs: 10 })).rejects.toThrow(
      /aborted by signal/,
    );
  });

  it('never touches the global fetch when fetchImpl is injected', async () => {
    const originalFetch = globalThis.fetch;
    let globalFetchCalls = 0;
    globalThis.fetch = () => {
      globalFetchCalls += 1;
      throw new Error('tests must not perform real network I/O');
    };
    try {
      const { fetchImpl } = recordingFetch([jsonResponse(krxDayFixture())]);
      const result = await fetchKrxNav({ fetchImpl, now: NOW });
      expect(result.navMap.size).toBe(2);
      expect(globalFetchCalls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
