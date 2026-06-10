import { fetchJson, mapLimit, optionalJson } from './http.mjs';
import { cleanText, nullableNumber } from './shared.mjs';

const ROOT = 'https://anchor.k-etf.com/api';
const LANG = 'ko';

// Snapshot keeps up to 25 holdings per ETF for the UI. The AIYN diversification
// score still uses only the top 10 (src/lib/scoring.js slices holdings to 10),
// so scores are unaffected by this limit.
export const HOLDINGS_LIMIT = 25;

export const KETF_SOURCES = {
  lineup: {
    name: 'K-ETF active ETF lineup',
    url: `${ROOT}/instrument/instruments/?lang=${LANG}&status=active&type=etf`,
  },
  quotes: {
    name: 'K-ETF instrument return',
    url: `${ROOT}/timeseries/instrument-return/?lang=${LANG}&type=etf&page=1&page_size=2000`,
  },
  compare: {
    name: 'K-ETF compare',
    url: `${ROOT}/instrument/compare/?range=1Y&lang=${LANG}&codes=...`,
  },
  priceRanking3m: {
    name: 'K-ETF price return ranking 3M',
    url: `${ROOT}/instrument/ranking/?type=PRICE_RETURN&range=3M&limit=2000&instrument_type=etf&lang=${LANG}`,
  },
  priceRanking1y: {
    name: 'K-ETF price return ranking 1Y',
    url: `${ROOT}/instrument/ranking/?type=PRICE_RETURN&range=1Y&limit=2000&instrument_type=etf&lang=${LANG}`,
  },
  dividendRanking: {
    name: 'K-ETF dividend return ranking 1Y',
    url: `${ROOT}/instrument/ranking/?type=DIVIDEND_RETURN&range=1Y&limit=2000&instrument_type=etf&lang=${LANG}`,
  },
  holdings: {
    name: 'K-ETF holdings',
    url: `${ROOT}/instrument/holdings/?code=...&language=${LANG}`,
  },
};

export async function fetchKoreanEtfBaseData() {
  const [lineup, quotes, price3m, price1y, dividends] = await Promise.all([
    fetchJson(KETF_SOURCES.lineup.url),
    fetchJson(KETF_SOURCES.quotes.url),
    fetchJson(KETF_SOURCES.priceRanking3m.url),
    fetchJson(KETF_SOURCES.priceRanking1y.url),
    fetchJson(KETF_SOURCES.dividendRanking.url),
  ]);

  const codes = lineup.data.map((item) => item.code);
  const compare = await fetchKoreanCompare(codes);
  const holdings = await fetchKoreanHoldings(codes);

  return {
    lineup,
    quotes,
    price3m,
    price1y,
    dividends,
    compare,
    holdings,
  };
}

export async function fetchKoreanCompare(codes) {
  const batches = chunk(codes, 200);
  const entries = await mapLimit(batches, 2, async (batch, index) => {
    const url = `${ROOT}/instrument/compare/?range=1Y&lang=${LANG}&codes=${batch.join(',')}`;
    console.log(
      `[data:update] K-ETF compare batch ${index + 1}/${batches.length} (${batch.length} ETFs)`,
    );
    const json = await fetchJson(url, { timeoutMs: 90_000 });
    return Object.entries(json.data ?? {});
  });
  return new Map(entries.flat());
}

export async function fetchKoreanHoldings(codes) {
  let completed = 0;
  const entries = await mapLimit(codes, 4, async (code) => {
    const url = `${ROOT}/instrument/holdings/?code=${encodeURIComponent(code)}&language=${LANG}`;
    const json = await optionalJson(url, { timeoutMs: 30_000 });
    completed += 1;
    if (completed % 100 === 0 || completed === codes.length) {
      console.log(`[data:update] K-ETF holdings ${completed}/${codes.length}`);
    }
    return [code, normalizeKoreanHoldings(json, url)];
  });
  return new Map(entries);
}

export function normalizeKoreanHoldings(json, url) {
  const rows = (json?.holdings ?? [])
    .map((holding) => ({
      name: cleanText(holding.name ?? holding.holding_name),
      ticker: cleanText(holding.holding_ticker ?? holding.ticker ?? holding.holding_isin) || null,
      weight: nullableNumber(holding.weight),
    }))
    .filter((holding) => holding.name && holding.weight !== null)
    .slice(0, HOLDINGS_LIMIT);

  return {
    holdings: rows,
    asOf: json?.asof ? `${json.asof}T00:00:00.000Z` : null,
    source: { name: KETF_SOURCES.holdings.name, url, fields: ['holdings'] },
  };
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
