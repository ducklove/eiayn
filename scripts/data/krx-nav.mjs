// KRX 정보데이터시스템 (data.krx.co.kr) NAV / premium-discount source.
//
// The 'ETF 전종목 시세' screen ([13104] MDCSTAT04301) is backed by a JSON
// endpoint that returns one row per listed ETF for a single trading day, so
// ONE request covers the entire Korean lineup. The endpoint is undocumented
// and unavailable from some networks, and returns no rows on non-trading
// days, so the whole integration is strictly best-effort: every failure mode
// must degrade to the previous behavior (nav/premiumDiscount stay null) and
// never abort the run. Values are parsed defensively and never guessed.

import { roundNullable } from './yahoo.mjs';

export const KRX_NAV_SOURCE_NAME = 'KRX 정보데이터시스템';
export const KRX_NAV_SOURCE_URL = 'http://data.krx.co.kr/';
export const KRX_NAV_ENDPOINT = 'http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd';
export const KRX_NAV_REFERER = 'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd';
export const KRX_NAV_BLD = 'dbms/MDC/STAT/standard/MDCSTAT04301';
// Today plus six prior calendar days: enough to bridge any KRX holiday
// cluster (e.g. Seollal/Chuseok plus an adjacent weekend).
export const KRX_NAV_MAX_ATTEMPTS = 7;

const KOREA_MARKET = '국내';
const DAY_MS = 86_400_000;
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Parses a KRX numeric cell. Values arrive as comma-formatted strings like
 * "10,123.45" (plain numbers are tolerated); missing values arrive as "-" or
 * "". Returns a finite number or null — never a guess.
 */
export function parseKrxNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replaceAll(',', '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

// The KRX response is an object whose payload lives under a non-contractual
// property name (commonly `output` or `OutBlock_1`). Detect it generically:
// the first own property whose value is a non-empty array of plain objects
// whose first row carries `ISU_SRT_CD`.
function krxRows(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  for (const value of Object.values(json)) {
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row)) &&
      Object.hasOwn(value[0], 'ISU_SRT_CD')
    ) {
      return value;
    }
  }
  return [];
}

/**
 * Parses a raw KRX 'ETF 전종목 시세' JSON response into a
 * `Map<ticker, { nav, close, premiumDiscount }>` keyed by the 6-digit short
 * code. `premiumDiscount` is `(close - nav) / nav * 100` rounded to 2
 * decimals. Rows with an unparseable or non-positive close or NAV are
 * skipped — missing data stays missing, never estimated.
 */
export function parseKrxNavRows(json) {
  const byTicker = new Map();
  for (const row of krxRows(json)) {
    const ticker = String(row.ISU_SRT_CD ?? '').trim();
    if (!/^\d{6}$/.test(ticker)) continue;
    const close = parseKrxNumber(row.TDD_CLSPRC);
    const nav = parseKrxNumber(row.NAV);
    if (close === null || close <= 0 || nav === null || nav <= 0) continue;
    byTicker.set(ticker, {
      nav,
      close,
      premiumDiscount: roundNullable(((close - nav) / nav) * 100),
    });
  }
  return byTicker;
}

export function krxNavSourceEntry(fields) {
  return { name: KRX_NAV_SOURCE_NAME, url: KRX_NAV_SOURCE_URL, fields };
}

/**
 * Applies KRX NAV data to a snapshot-wide ETF list. Returns a new array and
 * never mutates the inputs.
 *
 * Only Korean-market ETFs whose ticker is in `navMap` are enriched: `nav` is
 * filled only when currently null (K-ETF style fill-only-null),
 * `premiumDiscount` is set, `dataQuality.navAsOf` records the KRX trading day
 * (`tradeDate`, YYYY-MM-DD) the values are as of, and an inline source entry
 * listing the fields actually filled is appended to `dataQuality.sources`.
 * Every other ETF is returned unchanged except that `premiumDiscount: null`
 * is added so the field exists snapshot-wide — including when `navMap` is
 * empty because KRX was unavailable.
 */
export function applyKrxNavEnrichment(etfs, navMap, { tradeDate = null } = {}) {
  return etfs.map((etf) => {
    const quote = etf.market === KOREA_MARKET ? navMap.get(etf.ticker) : undefined;
    if (!quote) return { ...etf, premiumDiscount: etf.premiumDiscount ?? null };

    const filledFields = [];
    const enriched = { ...etf };
    if (enriched.nav === null || enriched.nav === undefined) {
      enriched.nav = quote.nav;
      filledFields.push('nav');
    }
    if (enriched.premiumDiscount === null || enriched.premiumDiscount === undefined) {
      enriched.premiumDiscount = quote.premiumDiscount;
      filledFields.push('premiumDiscount');
    }
    if (!filledFields.length) return enriched;

    return {
      ...enriched,
      dataQuality: {
        ...etf.dataQuality,
        ...(tradeDate ? { navAsOf: tradeDate } : {}),
        sources: [...(etf.dataQuality?.sources ?? []), krxNavSourceEntry(filledFields)],
      },
    };
  });
}

/** Formats a Date as the YYYY-MM-DD calendar date in Asia/Seoul. */
export function seoulDateString(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Fetches the KRX 'ETF 전종목 시세' table for the most recent trading day.
 *
 * Requests `trdDd` for today in Asia/Seoul and, when an attempt yields no
 * parseable rows (weekend/holiday) or fails outright, walks back one calendar
 * day at a time up to KRX_NAV_MAX_ATTEMPTS total attempts. Each request gets
 * its own ~15s AbortController timeout. Resolves with
 * `{ navMap, trdDd, tradeDate }` and throws a descriptive error after
 * exhausting all attempts — callers treat this source as best-effort.
 *
 * `fetchImpl` (default: global fetch) and `now` (Date or () => Date) are
 * injectable so tests never perform real network I/O.
 */
export async function fetchKrxNav({
  fetchImpl = fetch,
  now = () => new Date(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const seoulToday = seoulDateString(typeof now === 'function' ? now() : now);
  // Walking back in UTC milliseconds from the Seoul calendar date keeps the
  // day arithmetic timezone-free (Seoul has no DST).
  const anchorUtc = Date.parse(`${seoulToday}T00:00:00Z`);

  const tried = [];
  let lastFailure = 'no attempts made';
  for (let daysBack = 0; daysBack < KRX_NAV_MAX_ATTEMPTS; daysBack += 1) {
    const tradeDate = new Date(anchorUtc - daysBack * DAY_MS).toISOString().slice(0, 10);
    const trdDd = tradeDate.replaceAll('-', '');
    tried.push(trdDd);
    try {
      const navMap = parseKrxNavRows(await requestKrxJson(fetchImpl, trdDd, timeoutMs));
      if (navMap.size > 0) return { navMap, trdDd, tradeDate };
      lastFailure = `no parseable rows for trdDd=${trdDd}`;
    } catch (error) {
      lastFailure = `trdDd=${trdDd}: ${error.message}`;
    }
  }

  throw new Error(
    `KRX NAV endpoint returned no usable data after ${tried.length} attempts ` +
      `(trdDd ${tried.at(-1)}..${tried[0]}; last failure: ${lastFailure})`,
  );
}

async function requestKrxJson(fetchImpl, trdDd, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(KRX_NAV_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        referer: KRX_NAV_REFERER,
        'user-agent':
          'Mozilla/5.0 (compatible; EIAYNDataBot/1.0; +https://github.com/ducklove/eiayn)',
      },
      body: new URLSearchParams({
        bld: KRX_NAV_BLD,
        locale: 'ko_KR',
        trdDd,
        share: '1',
        money: '1',
        csvxls_isNo: 'false',
      }).toString(),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
