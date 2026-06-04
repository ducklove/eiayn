import { fetchJson } from './http.mjs';

export const YAHOO_CHART_ROOT = 'https://query1.finance.yahoo.com/v8/finance/chart';
export const YAHOO_MOST_ACTIVE_ETFS =
  'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved';

const MOST_ACTIVE_FIELDS = [
  'ticker',
  'symbol',
  'longName',
  'shortName',
  'regularMarketPrice',
  'regularMarketChange',
  'regularMarketChangePercent',
  'regularMarketVolume',
  'fundNetAssets',
  'netExpenseRatio',
  'grossExpenseRatio',
  'yieldTTM',
  'annualReturnNavY1',
  'annualReturnNavY3',
  'annualReturnNavY5',
  'trailing3mReturn',
  'trailingYtdReturn',
  'exchange',
];

export async function fetchYahooMostActiveEtfs(count = 150) {
  const url = new URL(YAHOO_MOST_ACTIVE_ETFS);
  url.search = new URLSearchParams({
    count: String(count),
    formatted: 'false',
    scrIds: 'MOST_ACTIVES_ETFS',
    start: '0',
    useRecordsResponse: 'true',
    fields: MOST_ACTIVE_FIELDS.join(','),
    lang: 'en-US',
    region: 'US',
  }).toString();
  const json = await fetchJson(url.toString());
  const records = json.finance?.result?.[0]?.records;
  if (!Array.isArray(records)) throw new Error('Yahoo most active ETF screener returned no records');
  return {
    records,
    source: {
      name: 'Yahoo Finance MOST_ACTIVES_ETFS screener',
      url: url.toString(),
      fields: MOST_ACTIVE_FIELDS,
    },
  };
}

export async function fetchYahooChart(symbol, range = '5y') {
  const url = yahooChartUrl(symbol, range);
  const json = await fetchJson(url);
  const result = json.chart?.result?.[0];
  if (!result) {
    const message = json.chart?.error?.description ?? 'Yahoo chart response missing result';
    throw new Error(`${message}: ${symbol}`);
  }

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const series = [];
  const quotes = [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const close = asNumber(quote.close?.[index]);
    const adjustedClose = asNumber(adjusted[index]) ?? close;
    const date = new Date(timestamps[index] * 1000).toISOString().slice(0, 10);
    if (close !== null || adjustedClose !== null) {
      const point = {
        date,
        close,
        adjustedClose,
        volume: asNumber(quote.volume?.[index]),
      };
      series.push(point);
      quotes.push(point);
    }
  }

  const meta = result.meta ?? {};
  return {
    url,
    meta,
    series,
    quotes,
    dividends: Object.values(result.events?.dividends ?? {}),
    quoteAsOf: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : null,
    firstTradeDate: meta.firstTradeDate
      ? new Date(meta.firstTradeDate * 1000).toISOString().slice(0, 10)
      : null,
  };
}

export async function fetchExchangeRate() {
  const chart = await fetchYahooChart('USDKRW=X', '5d');
  const latest = chart.meta.regularMarketPrice ?? chart.quotes.at(-1)?.close ?? null;
  const previous = chart.quotes.at(-2)?.close ?? null;
  return {
    pair: 'USD/KRW',
    value: roundNullable(latest, 4),
    changePercent: latest && previous ? roundNullable(((latest / previous) - 1) * 100) : null,
    asOf: chart.quoteAsOf,
    source: { name: 'Yahoo Finance chart', url: chart.url },
  };
}

export function yahooChartUrl(symbol, range) {
  const url = new URL(`${YAHOO_CHART_ROOT}/${encodeURIComponent(symbol)}`);
  url.search = new URLSearchParams({
    range,
    interval: '1d',
    events: 'div|split',
    includeAdjustedClose: 'true',
  }).toString();
  return url.toString();
}

export function trailingDividendYield(dividends, price) {
  if (!price) return null;
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const total = dividends.reduce((sum, dividend) => (
    dividend.date * 1000 >= cutoff ? sum + (asNumber(dividend.amount) ?? 0) : sum
  ), 0);
  return total > 0 ? roundNullable((total / price) * 100) : null;
}

export function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function roundNullable(value, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(digits))
    : null;
}
