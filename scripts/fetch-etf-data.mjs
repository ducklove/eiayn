import { load } from 'cheerio';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  calculateAnnualizedReturn,
  calculateAnnualizedVolatility,
  calculateMaxDrawdown,
  calculatePeriodReturn,
  calculateSharpeRatio,
  normalizeSparkline,
  parseCompactMoney,
  parsePercent,
  sliceSeriesFrom,
} from '../src/lib/metrics.js';
import { collectMissingFields } from '../src/lib/normalize.js';
import { scoreEtfs } from '../src/lib/scoring.js';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'data');
const OUT_FILE = path.join(OUT_DIR, 'etfs.json');
const GENERATED_AT = new Date().toISOString();

const UNIVERSE = [
  {
    id: '360750',
    ticker: '360750',
    yahooSymbol: '360750.KS',
    stockAnalysisPath: '/quote/krx/360750/',
    name: 'TIGER 미국S&P500',
    shortName: 'TIGER S&P500',
    provider: '미래에셋',
    market: '국내',
    assetClass: '주식',
    theme: '대표지수',
    category: '미국 대형주',
    benchmarkIndex: 'S&P 500',
    currency: 'KRW',
  },
  {
    id: '379800',
    ticker: '379800',
    yahooSymbol: '379800.KS',
    stockAnalysisPath: '/quote/krx/379800/',
    name: 'KODEX 미국S&P500TR',
    shortName: 'KODEX S&P500TR',
    provider: '삼성자산운용',
    market: '국내',
    assetClass: '주식',
    theme: '대표지수',
    category: '미국 대형주',
    benchmarkIndex: 'S&P 500 TR',
    currency: 'KRW',
  },
  {
    id: '458730',
    ticker: '458730',
    yahooSymbol: '458730.KS',
    stockAnalysisPath: '/quote/krx/458730/',
    name: 'TIGER 미국배당다우존스',
    shortName: 'TIGER 배당다우',
    provider: '미래에셋',
    market: '국내',
    assetClass: '주식',
    theme: '배당',
    category: '미국 배당성장',
    benchmarkIndex: 'Dow Jones U.S. Dividend 100',
    currency: 'KRW',
  },
  {
    id: '069500',
    ticker: '069500',
    yahooSymbol: '069500.KS',
    stockAnalysisPath: '/quote/krx/069500/',
    name: 'KODEX 200',
    shortName: 'KODEX 200',
    provider: '삼성자산운용',
    market: '국내',
    assetClass: '주식',
    theme: '대표지수',
    category: 'KOSPI 200',
    benchmarkIndex: 'KOSPI 200',
    currency: 'KRW',
  },
  {
    id: '091160',
    ticker: '091160',
    yahooSymbol: '091160.KS',
    stockAnalysisPath: '/quote/krx/091160/',
    name: 'KODEX 반도체',
    shortName: 'KODEX 반도체',
    provider: '삼성자산운용',
    market: '국내',
    assetClass: '주식',
    theme: '반도체',
    category: '국내 반도체',
    benchmarkIndex: 'KRX Semicon',
    currency: 'KRW',
  },
  {
    id: 'QQQ',
    ticker: 'QQQ',
    yahooSymbol: 'QQQ',
    stockAnalysisPath: '/etf/qqq/',
    name: 'Invesco QQQ Trust',
    shortName: 'QQQ',
    provider: 'Invesco',
    market: '미국',
    assetClass: '주식',
    theme: '테크',
    category: 'NASDAQ-100',
    benchmarkIndex: 'NASDAQ-100',
    currency: 'USD',
  },
  {
    id: 'VTI',
    ticker: 'VTI',
    yahooSymbol: 'VTI',
    stockAnalysisPath: '/etf/vti/',
    name: 'Vanguard Total Stock Market ETF',
    shortName: 'VTI',
    provider: 'Vanguard',
    market: '미국',
    assetClass: '주식',
    theme: '대표지수',
    category: '미국 전체시장',
    benchmarkIndex: 'CRSP US Total Market',
    currency: 'USD',
  },
  {
    id: 'SOXX',
    ticker: 'SOXX',
    yahooSymbol: 'SOXX',
    stockAnalysisPath: '/etf/soxx/',
    name: 'iShares Semiconductor ETF',
    shortName: 'SOXX',
    provider: 'iShares',
    market: '미국',
    assetClass: '주식',
    theme: '반도체',
    category: '글로벌 반도체',
    benchmarkIndex: 'NYSE Semiconductor',
    currency: 'USD',
  },
  {
    id: 'SCHD',
    ticker: 'SCHD',
    yahooSymbol: 'SCHD',
    stockAnalysisPath: '/etf/schd/',
    name: 'Schwab U.S. Dividend Equity ETF',
    shortName: 'SCHD',
    provider: 'Schwab',
    market: '미국',
    assetClass: '주식',
    theme: '배당',
    category: '미국 배당성장',
    benchmarkIndex: 'Dow Jones U.S. Dividend 100',
    currency: 'USD',
  },
  {
    id: 'ARKK',
    ticker: 'ARKK',
    yahooSymbol: 'ARKK',
    stockAnalysisPath: '/etf/arkk/',
    name: 'ARK Innovation ETF',
    shortName: 'ARKK',
    provider: 'ARK Invest',
    market: '미국',
    assetClass: '주식',
    theme: '혁신성장',
    category: '테마 성장주',
    benchmarkIndex: 'Active',
    currency: 'USD',
  },
];

async function main() {
  console.log(`[data:update] Fetching ${UNIVERSE.length} ETFs`);
  const etfs = [];
  for (const instrument of UNIVERSE) {
    console.log(`[data:update] ${instrument.id} ${instrument.name}`);
    etfs.push(await fetchEtf(instrument));
  }

  const scoredEtfs = scoreEtfs(etfs).map((etf) => ({
      ...etf,
      dataQuality: {
        ...etf.dataQuality,
        missingFields: collectMissingFields(etf),
      },
    }));

  const usdKrw = await fetchExchangeRate();
  const payload = {
    generatedAt: GENERATED_AT,
    timezone: 'Asia/Seoul',
    universe: scoredEtfs.map((etf) => etf.id),
    sources: [
      {
        name: 'Yahoo Finance chart',
        url: 'https://query1.finance.yahoo.com/v8/finance/chart/',
        fields: ['price', 'changePercent', 'historical adjusted close', 'dividends', 'USD/KRW'],
      },
      {
        name: 'StockAnalysis',
        url: 'https://stockanalysis.com/',
        fields: ['expenseRatio', 'aum', 'dividendYield', 'inceptionDate', 'holdings'],
      },
      {
        name: 'EIAYN universe metadata',
        url: 'https://github.com/ducklove/eiayn',
        fields: ['provider', 'market', 'assetClass', 'theme', 'category', 'benchmarkIndex'],
      },
    ],
    exchangeRates: {
      usdKrw,
    },
    etfs: scoredEtfs,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[data:update] Wrote ${path.relative(ROOT, OUT_FILE)}`);
}

async function fetchEtf(instrument) {
  const chartUrl = yahooChartUrl(instrument.yahooSymbol, '5y');
  const chart = await fetchYahooChart(chartUrl);
  const profileUrl = `https://stockanalysis.com${instrument.stockAnalysisPath}`;
  const holdingsUrl = `${profileUrl.replace(/\/$/, '')}/holdings/`;
  const [profile, holdings] = await Promise.all([
    fetchStockAnalysisProfile(profileUrl, instrument.currency),
    fetchStockAnalysisHoldings(holdingsUrl),
  ]);

  const series = chart.series.map((point) => ({
    date: point.date,
    value: point.adjustedClose ?? point.close,
  }));
  const series3y = sliceSeriesFrom(series, { years: 3 });
  const latestQuote = chart.quotes.at(-1);
  const previousQuote = chart.quotes.at(-2);
  const price = chart.meta.regularMarketPrice ?? latestQuote?.close ?? null;
  const changePercent = price && previousQuote?.close
    ? ((price / previousQuote.close) - 1) * 100
    : null;
  const dividendYieldFromEvents = trailingDividendYield(chart.dividends, price, instrument.currency);

  return {
    id: instrument.id,
    ticker: instrument.ticker,
    yahooSymbol: instrument.yahooSymbol,
    name: instrument.name,
    shortName: instrument.shortName,
    provider: instrument.provider,
    market: instrument.market,
    assetClass: instrument.assetClass,
    theme: instrument.theme,
    category: instrument.category,
    benchmarkIndex: instrument.benchmarkIndex,
    currency: instrument.currency,
    price: roundNullable(price, instrument.currency === 'KRW' ? 0 : 2),
    changePercent: roundNullable(changePercent),
    expenseRatio: profile.expenseRatio,
    aum: profile.aum?.value ?? null,
    dividendYield: profile.dividendYield ?? dividendYieldFromEvents,
    inceptionDate: profile.inceptionDate ?? chart.firstTradeDate,
    nav: null,
    returns: {
      m3: roundNullable(calculatePeriodReturn(series, { months: 3 })),
      y1: roundNullable(calculatePeriodReturn(series, { years: 1 })),
      y3Annualized: roundNullable(calculateAnnualizedReturn(series, 3)),
      y5Annualized: roundNullable(calculateAnnualizedReturn(series, 5)),
    },
    risk: {
      volatility3yAnnualized: roundNullable(calculateAnnualizedVolatility(series3y)),
      maxDrawdown3y: roundNullable(calculateMaxDrawdown(series3y)),
      sharpe3y: roundNullable(calculateSharpeRatio(series3y)),
      trackingError3y: null,
      informationRatio3y: null,
    },
    holdings: holdings.slice(0, 10),
    sparkline: normalizeSparkline(series),
    dataQuality: {
      quoteAsOf: chart.quoteAsOf,
      profileAsOf: GENERATED_AT,
      holdingsAsOf: GENERATED_AT,
      sources: [
        { name: 'Yahoo Finance chart', url: chartUrl, fields: ['price', 'history', 'dividends'] },
        { name: 'StockAnalysis profile', url: profileUrl, fields: ['expenseRatio', 'aum', 'dividendYield', 'inceptionDate'] },
        { name: 'StockAnalysis holdings', url: holdingsUrl, fields: ['holdings'] },
      ],
      missingFields: [],
    },
  };
}

async function fetchYahooChart(url) {
  const json = await fetchJson(url);
  const result = json.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo chart response missing result: ${url}`);
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
    meta,
    series,
    quotes,
    dividends: Object.values(result.events?.dividends ?? {}),
    quoteAsOf: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : GENERATED_AT,
    firstTradeDate: meta.firstTradeDate
      ? new Date(meta.firstTradeDate * 1000).toISOString().slice(0, 10)
      : null,
  };
}

async function fetchExchangeRate() {
  const url = yahooChartUrl('USDKRW=X', '5d');
  const chart = await fetchYahooChart(url);
  const latest = chart.meta.regularMarketPrice ?? chart.quotes.at(-1)?.close ?? null;
  const previous = chart.quotes.at(-2)?.close ?? null;
  return {
    pair: 'USD/KRW',
    value: roundNullable(latest, 4),
    changePercent: latest && previous ? roundNullable(((latest / previous) - 1) * 100) : null,
    asOf: chart.quoteAsOf,
    source: { name: 'Yahoo Finance chart', url },
  };
}

async function fetchStockAnalysisProfile(url, currency) {
  const html = await fetchText(url);
  const $ = load(html);
  const aum = parseCompactMoney(summaryValue($, 'Assets'), currency);
  return {
    expenseRatio: parsePercent(summaryValue($, 'Expense Ratio')),
    aum,
    dividendYield: parsePercent(summaryValue($, 'Dividend Yield')),
    inceptionDate: parseDate(summaryValue($, 'Inception Date')),
  };
}

async function fetchStockAnalysisHoldings(url) {
  const html = await fetchText(url);
  const $ = load(html);
  const rows = [];
  $('table').each((_, table) => {
    const headers = $(table).find('th').map((__, th) => cleanText($(th).text())).get();
    const nameIndex = headers.findIndex((header) => /^name$/i.test(header));
    const tickerIndex = headers.findIndex((header) => /^(symbol|ticker)$/i.test(header));
    const weightIndex = headers.findIndex((header) => /weight/i.test(header));
    if (nameIndex < 0 || weightIndex < 0) return;
    $(table).find('tbody tr').each((__, row) => {
      const cells = $(row).find('td').map((___, td) => cleanText($(td).text())).get();
      if (cells.length <= Math.max(nameIndex, weightIndex)) return;
      const weight = parsePercent(cells[weightIndex]);
      if (weight === null) return;
      rows.push({
        name: cells[nameIndex],
        ticker: tickerIndex >= 0 ? cells[tickerIndex] || null : null,
        weight,
      });
    });
  });
  return rows;
}

function summaryValue($, label) {
  let value = null;
  $('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cleanText(cells.eq(0).text()) === label) {
      value = cleanText(cells.eq(1).text());
    }
  });
  return value;
}

function yahooChartUrl(symbol, range) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.search = new URLSearchParams({
    range,
    interval: '1d',
    events: 'div|split',
    includeAdjustedClose: 'true',
  }).toString();
  return url.toString();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url, 'application/json,text/plain,*/*'));
}

async function fetchText(url, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
  const maxAttempts = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept,
          'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'user-agent': 'Mozilla/5.0 (compatible; EIAYNDataBot/1.0; +https://github.com/ducklove/eiayn)',
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      console.warn(`[data:update] Fetch failed (${attempt}/${maxAttempts}) ${url}: ${error.message}`);
      if (attempt < maxAttempts) await wait(750 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message}`);
}

function trailingDividendYield(dividends, price) {
  if (!price) return null;
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const total = dividends.reduce((sum, dividend) => (
    dividend.date * 1000 >= cutoff ? sum + (asNumber(dividend.amount) ?? 0) : sum
  ), 0);
  return total > 0 ? roundNullable((total / price) * 100) : null;
}

function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function roundNullable(value, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(digits))
    : null;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  console.error(`[data:update] ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
