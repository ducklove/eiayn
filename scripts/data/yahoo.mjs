import { fetchJson, wait } from './http.mjs';

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

export async function fetchYahooQuoteSummaryProfile(symbol) {
  const url = yahooQuoteSummaryUrl(symbol);
  try {
    const json = await fetchYahooQuoteSummary(url);
    const result = json.quoteSummary?.result?.[0];
    if (!result) throw new Error(json.quoteSummary?.error?.description ?? 'Yahoo quoteSummary response missing result');

    const fees = result.fundProfile?.feesExpensesInvestment ?? {};
    const statistics = result.defaultKeyStatistics ?? {};
    const summary = result.summaryDetail ?? {};
    const annualReportExpenseRatio = asNumber(fees.annualReportExpenseRatio);
    const totalAssets = asNumber(statistics.totalAssets);
    const yieldDecimal = asNumber(summary.yield) ?? asNumber(summary.dividendYield);

    return {
      source: {
        name: 'Yahoo Finance quoteSummary',
        url,
        fields: ['expenseRatio', 'aum', 'dividendYield', 'inceptionDate'],
      },
      expenseRatio: annualReportExpenseRatio > 0 ? roundNullable(annualReportExpenseRatio * 100, 4) : null,
      aum: totalAssets,
      dividendYield: yieldDecimal !== null ? roundNullable(yieldDecimal * 100) : null,
      inceptionDate: statistics.fundInceptionDate
        ? new Date(statistics.fundInceptionDate * 1000).toISOString().slice(0, 10)
        : null,
    };
  } catch (error) {
    console.warn(`[data:update] Optional source unavailable ${url}: ${error.message}`);
    return emptyQuoteSummaryProfile();
  }
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

export function yahooQuoteSummaryUrl(symbol) {
  const url = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`);
  url.search = new URLSearchParams({
    modules: 'fundProfile,defaultKeyStatistics,summaryDetail,price',
    formatted: 'false',
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

let yahooSessionPromise = null;

async function fetchYahooQuoteSummary(baseUrl) {
  let session = await yahooSession();
  let response = await fetchWithYahooSession(baseUrl, session);
  let text = await response.text();

  if (response.status === 401 || /Invalid (Crumb|Cookie)/i.test(text)) {
    yahooSessionPromise = null;
    session = await yahooSession();
    response = await fetchWithYahooSession(baseUrl, session);
    text = await response.text();
  }

  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return JSON.parse(text);
}

async function yahooSession() {
  yahooSessionPromise ??= createYahooSession();
  return yahooSessionPromise;
}

async function createYahooSession() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const seed = await fetch('https://fc.yahoo.com', {
        headers: yahooHeaders(),
      });
      const cookie = seed.headers.get('set-cookie');
      const cookies = cookie
        ?.split(/,(?=\s*[^;]+?=)/)
        .map((item) => item.split(';')[0])
        .join('; ');
      if (!cookies) throw new Error('Yahoo session cookie missing');

      const crumbResponse = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        headers: yahooHeaders(cookies),
      });
      const crumb = await crumbResponse.text();
      if (!crumbResponse.ok || !crumb || crumb.includes('{')) {
        throw new Error(`Yahoo crumb unavailable: ${crumbResponse.status}`);
      }
      return { cookies, crumb };
    } catch (error) {
      if (attempt === 3) throw error;
      await wait(800 * attempt);
    }
  }
  throw new Error('Yahoo session unavailable');
}

async function fetchWithYahooSession(baseUrl, session) {
  const url = new URL(baseUrl);
  url.searchParams.set('crumb', session.crumb);
  return fetch(url, {
    headers: yahooHeaders(session.cookies),
  });
}

function yahooHeaders(cookies) {
  return {
    accept: 'application/json,text/plain,*/*',
    'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'user-agent': 'Mozilla/5.0 (compatible; EIAYNDataBot/1.0; +https://github.com/ducklove/eiayn)',
    ...(cookies ? { cookie: cookies } : {}),
  };
}

function emptyQuoteSummaryProfile() {
  return {
    source: null,
    expenseRatio: null,
    aum: null,
    dividendYield: null,
    inceptionDate: null,
  };
}
