// Naver Finance Korean ETF source.
//
// Replaces the K-ETF anchor API (privatized behind its own backend, 403 for
// all external callers since 2026-06-26) and the KRX 정보데이터시스템 screens
// (relaunched as the login-only "KRX Data Marketplace"). Two public Naver
// endpoints cover the same ground:
//
// - `finance.naver.com/api/sise/etfItemList.nhn`: ONE request returns every
//   listed Korean ETF with live price, 1-day change, iNAV, volume, trading
//   value (백만원), and market cap (억원).
// - `m.stock.naver.com/api/stock/{code}/etfAnalysis`: per-ETF profile with
//   issuer, total fee, base index, listing date, official previous-day NAV,
//   deviation (premium/discount), period returns, TTM dividend yield, theme
//   classification, and the top-10 constituents.
//
// The lineup request is required (no lineup, no Korean universe — the run
// must fail loudly). Every per-ETF analysis fetch is best-effort: a missing
// analysis leaves profile-level fields null and holdings empty, and never
// excludes the ETF or aborts the run.

import { fetchJson, mapLimit, optionalJson } from './http.mjs';
import { cleanText, nullableNumber } from './shared.mjs';

const LINEUP_URL =
  'https://finance.naver.com/api/sise/etfItemList.nhn?etfType=0&targetColumn=market_sum&sortOrder=desc';

export const NAVER_SOURCES = {
  lineup: {
    name: 'Naver Finance ETF 전종목 시세',
    url: LINEUP_URL,
  },
  analysis: {
    name: 'Naver Finance ETF 분석',
    url: 'https://m.stock.naver.com/api/stock/{code}/etfAnalysis',
  },
};

export function naverAnalysisUrl(code) {
  return NAVER_SOURCES.analysis.url.replace('{code}', encodeURIComponent(code));
}

export async function fetchKoreanEtfBaseData() {
  const lineup = await fetchNaverEtfLineup();
  const codes = lineup.map((item) => item.itemcode);
  const analyses = await fetchNaverEtfAnalyses(codes);
  return { lineup, analyses };
}

/**
 * Fetches and validates the full ETF lineup. Throws when the response does
 * not carry a non-empty `result.etfItemList` — an empty Korean universe means
 * the source changed shape and the refresh must fail without committing.
 * The endpoint serves EUC-KR, so the charset must be decoded explicitly.
 */
export async function fetchNaverEtfLineup() {
  const json = await fetchJson(LINEUP_URL, { charset: 'euc-kr' });
  const items = json?.result?.etfItemList;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`Naver ETF lineup returned no items (${LINEUP_URL})`);
  }
  // KRX short codes are 6 chars; the post-2026 scheme is alphanumeric
  // (e.g. '0167A0'), so digits-only filtering would drop ~280 listings.
  return items.filter((item) => /^[0-9A-Z]{6}$/.test(String(item?.itemcode ?? '')));
}

/** Fetches per-ETF analyses best-effort. Returns Map<code, analysis|null>. */
export async function fetchNaverEtfAnalyses(codes, { concurrency = 5 } = {}) {
  let completed = 0;
  const entries = await mapLimit(codes, concurrency, async (code) => {
    const json = await optionalJson(naverAnalysisUrl(code), { timeoutMs: 30_000 });
    completed += 1;
    if (completed % 100 === 0 || completed === codes.length) {
      console.log(`[data:update] Naver ETF analysis ${completed}/${codes.length}`);
    }
    return [code, json];
  });
  return new Map(entries);
}

/** Parses Naver's "20021014" listing date into "2002-10-14", or null. */
export function parseNaverListedDate(value) {
  const digits = String(value ?? '').trim();
  if (!/^\d{8}$/.test(digits)) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** Parses "2026.07.21" reference dates into "2026-07-21", or null. */
export function parseNaverReferenceDate(value) {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(String(value ?? '').trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** Strips the "(ETF)" suffix Naver appends to some issuer names. */
export function normalizeIssuerName(value) {
  const cleaned = cleanText(value).replace(/\(ETF\)$/i, '');
  return cleaned ? cleaned.trim() : null;
}

/**
 * Signed premium/discount (%) from Naver's split sign/magnitude fields.
 * `deviationRate` arrives as a non-negative magnitude with `deviationSign`
 * '+' or '-'. Returns null when the magnitude is missing or implausible
 * (|x| > 50 fails snapshot validation, so bad upstream data degrades to null
 * instead of blocking the refresh).
 */
export function parseDeviation(analysis) {
  const magnitude = nullableNumber(analysis?.deviationRate);
  if (magnitude === null || Math.abs(magnitude) > 50) return null;
  return analysis?.deviationSign === '-' ? -Math.abs(magnitude) : Math.abs(magnitude);
}

/** Reads one periodTypeCode value from returnPerformanceList, or null. */
export function periodReturn(analysis, periodTypeCode) {
  const list = analysis?.returnPerformanceList;
  if (!Array.isArray(list)) return null;
  const entry = list.find((item) => item?.periodTypeCode === periodTypeCode);
  return nullableNumber(entry?.value);
}

/**
 * Normalizes `etfTop10MajorConstituentAssets` rows. Weights arrive as
 * strings like "38.69%"; rows whose weight Naver reports as "-" (common for
 * foreign-listed and bond constituents) are kept with `weight: null` — the
 * names still power the integrated holdings search, and the scorer counts
 * only weighted rows toward concentration (src/lib/scoring.js), so a
 * weightless row can never read as zero concentration.
 */
export function normalizeNaverHoldings(analysis, url) {
  const rows = (analysis?.etfTop10MajorConstituentAssets ?? [])
    .map((asset) => ({
      name: cleanText(asset?.itemName),
      ticker: cleanText(asset?.itemCode) || null,
      weight: nullableNumber(String(asset?.etfWeight ?? '').replace(/[%,\s]/g, '')),
    }))
    .filter((holding) => holding.name);

  return {
    holdings: rows,
    source: rows.length ? { name: NAVER_SOURCES.analysis.name, url, fields: ['holdings'] } : null,
  };
}

// --- Classification -------------------------------------------------------
//
// K-ETF supplied vendor category codes (EQ_/FI_/MA_/CM_ prefixes); Naver has
// no equivalent, so asset class and theme are derived from the ETF name, the
// base index name, and Naver's theme labels. Rules aim to reproduce the
// established snapshot vocabulary (assetClass ∈ 주식/채권/혼합자산/원자재/ETF,
// themes like 시장대표/배당/반도체/커버드콜/...) so filters and diffs stay
// stable across the source migration.

const BOND_PATTERN =
  /채권|국고채|회사채|국공채|통안|단기채|금융채|본드|크레딧|하이일드|KIS|KAP|KOFR|SOFR|CD금리|머니마켓|초단기|만기매칭|스트립|국채/i;
const COMMODITY_PATTERN =
  /골드|금현물|금선물|은선물|은현물|원유|WTI|천연가스|구리|니켈|팔라듐|백금|농산물|콩|옥수수|원자재|커머더티|에너지선물/;
const MIXED_PATTERN = /TDF|TRF|자산배분|채권혼합|주식혼합|혼합|밸런스|EMP|멀티에셋/i;
const CURRENCY_PATTERN = /달러선물|미국달러|엔선물|일본엔|유로선물|환율/;

export function classifyKoreanAssetClass({ name = '', baseIndex = '', tabCode = null } = {}) {
  const text = `${name} ${baseIndex}`;
  if (MIXED_PATTERN.test(text)) return '혼합자산';
  if (tabCode === 6 || BOND_PATTERN.test(text)) return '채권';
  if (tabCode === 5 || COMMODITY_PATTERN.test(text)) return '원자재';
  // Currency-futures ETFs kept the legacy uncategorized bucket in the K-ETF
  // era; preserve it so the assetClass filter set stays unchanged.
  if (CURRENCY_PATTERN.test(text)) return 'ETF';
  return '주식';
}

const THEME_RULES = [
  [/커버드콜|데일리커버드|프리미엄커버드/, '커버드콜'],
  [/인버스|곱버스/, '인버스'],
  [/레버리지/, '레버리지'],
  [/배당/, '배당'],
  [/반도체/, '반도체'],
  [/AI|인공지능|로봇|로보틱스/i, 'AI/로봇'],
  [/2차전지|배터리/, '2차전지'],
  [/리츠|REITs/i, '리츠'],
  [/TDF/i, 'TDF'],
  [/TRF|자산배분|EMP/i, '자산배분'],
  [/KOFR|SOFR|CD금리|금리액티브|머니마켓|초단기/i, '금리'],
  [/미국달러|달러선물/, '미국달러'],
  [/골드|금현물|금선물/, '금'],
  [/원유|WTI/, '원유'],
  [/바이오|헬스케어|의료/, '헬스케어'],
  [
    /코스피|코스닥|KOSPI|KOSDAQ|KRX ?300|MSCI Korea|S&P ?500|나스닥|NASDAQ|다우|Dow Jones Industrial|니케이|Nikkei|선진국|시장대표/i,
    '시장대표',
  ],
];

export function classifyKoreanTheme({
  name = '',
  baseIndex = '',
  themeMiddle = '',
  assetClass = '주식',
} = {}) {
  if (assetClass === '채권') return '채권';
  // The ETF name is the strongest signal; the base index catches plain-name
  // listings like 'KODEX 200' whose index is '코스피 200'.
  for (const text of [name, baseIndex]) {
    for (const [pattern, theme] of THEME_RULES) {
      if (pattern.test(text)) return theme;
    }
  }
  const middle = cleanText(themeMiddle);
  if (middle) return middle;
  return '기타';
}

export function koreanCategory({ assetClass, theme }) {
  if (!theme || theme === assetClass) return assetClass;
  return `${assetClass}-${theme}`;
}
