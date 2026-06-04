import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  calculateAnnualizedReturn,
  calculateAnnualizedVolatility,
  calculateMaxDrawdown,
  calculatePeriodReturn,
  calculateSharpeRatio,
  normalizeSparkline,
  sliceSeriesFrom,
} from '../src/lib/metrics.js';
import { collectMissingFields } from '../src/lib/normalize.js';
import { scoreEtfs } from '../src/lib/scoring.js';
import { fetchKoreanEtfBaseData, KETF_SOURCES } from './data/k-etf.mjs';
import { mapLimit } from './data/http.mjs';
import {
  fetchExchangeRate,
  fetchYahooChart,
  fetchYahooMostActiveEtfs,
  roundNullable,
  trailingDividendYield,
  YAHOO_CHART_ROOT,
} from './data/yahoo.mjs';
import {
  fetchStockAnalysisHoldings,
  fetchStockAnalysisProfile,
  stockAnalysisPathForTicker,
} from './data/stockanalysis.mjs';
import { GLOBAL_REPRESENTATIVE_ETFS, US_CORE_SUPPLEMENTS } from './data/universe.mjs';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'data');
const OUT_FILE = path.join(OUT_DIR, 'etfs.json');
const GENERATED_AT = new Date().toISOString();
const US_MOST_ACTIVE_COUNT = Number(process.env.US_MOST_ACTIVE_COUNT ?? 150);
const US_STOCKANALYSIS_LIMIT = Number(process.env.US_STOCKANALYSIS_LIMIT ?? 40);

async function main() {
  const excluded = [];

  console.log('[data:update] Collecting Korea active ETF universe');
  const koreanBase = await fetchKoreanEtfBaseData();
  const koreaEtfs = buildKoreanEtfs(koreanBase);
  console.log(`[data:update] Korea ETFs normalized: ${koreaEtfs.length}/${koreanBase.lineup.trace?.total ?? koreaEtfs.length}`);

  console.log(`[data:update] Collecting Yahoo most active US ETFs (${US_MOST_ACTIVE_COUNT})`);
  const usData = await fetchUsEtfs(excluded);
  console.log(`[data:update] US ETFs normalized: ${usData.etfs.length}`);

  console.log('[data:update] Collecting regional representative ETFs');
  const regionalEtfs = await fetchRegionalEtfs(excluded);
  console.log(`[data:update] Regional ETFs normalized: ${regionalEtfs.length}`);

  const etfs = dedupeEtfs([...koreaEtfs, ...usData.etfs, ...regionalEtfs])
    .sort(sortEtfsForDisplay);

  const scoredEtfs = scoreEtfs(etfs).map((etf) => ({
    ...etf,
    dataQuality: {
      ...etf.dataQuality,
      missingFields: collectMissingFields(etf),
    },
  }));

  const usdKrw = await fetchExchangeRate();
  const marketCounts = countBy(scoredEtfs, 'market');
  const payload = {
    generatedAt: GENERATED_AT,
    timezone: 'Asia/Seoul',
    universe: scoredEtfs.map((etf) => etf.id),
    coverage: {
      korea: {
        sourceTotal: koreanBase.lineup.trace?.total ?? null,
        included: koreaEtfs.length,
        quoteAsOf: koreanBase.quotes.trace?.latest_ts ?? null,
      },
      us: {
        mostActiveRequested: US_MOST_ACTIVE_COUNT,
        screenerRecords: usData.screenerRecords,
        coreSupplements: US_CORE_SUPPLEMENTS.map(supplementTicker),
        stockAnalysisEnrichmentLimit: US_STOCKANALYSIS_LIMIT,
        included: usData.etfs.length,
      },
      regional: marketCounts,
      excluded,
    },
    sources: [
      {
        name: 'K-ETF',
        url: 'https://www.k-etf.com/',
        fields: ['Korea active ETF lineup', 'price', 'trading value', 'market cap', 'fees', '1Y history', 'holdings'],
      },
      {
        name: 'Yahoo Finance MOST_ACTIVES_ETFS screener',
        url: 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved',
        fields: ['US high-volume ETF universe', 'price', 'volume', 'AUM', 'expense ratio'],
      },
      {
        name: 'Yahoo Finance chart',
        url: YAHOO_CHART_ROOT,
        fields: ['price', 'historical adjusted close', 'dividends', 'USD/KRW'],
      },
      {
        name: 'StockAnalysis',
        url: 'https://stockanalysis.com/',
        fields: ['expenseRatio', 'aum', 'dividendYield', 'inceptionDate', 'holdings'],
      },
      {
        name: 'EIAYN regional representative universe',
        url: 'https://github.com/ducklove/eiayn',
        fields: ['regional representative ETF selection', 'market classification'],
      },
    ],
    exchangeRates: {
      usdKrw,
    },
    etfs: scoredEtfs,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[data:update] Wrote ${path.relative(ROOT, OUT_FILE)} (${scoredEtfs.length} ETFs)`);
}

function buildKoreanEtfs(base) {
  const quoteByCode = new Map((base.quotes.data ?? []).map((quote) => [quote.code, quote]));
  const price3mByCode = new Map((base.price3m.data ?? []).map((item) => [item.code, item]));
  const price1yByCode = new Map((base.price1y.data ?? []).map((item) => [item.code, item]));
  const dividendByCode = new Map((base.dividends.data ?? []).map((item) => [item.code, item]));

  return (base.lineup.data ?? []).map((lineupItem) => {
    const code = lineupItem.code;
    const quote = quoteByCode.get(code);
    const compare = base.compare.get(code);
    const price3m = price3mByCode.get(code);
    const price1y = price1yByCode.get(code);
    const dividend = dividendByCode.get(code);
    const metadata = price1y ?? price3m ?? dividend ?? {};
    const holdingsData = base.holdings.get(code) ?? { holdings: [], asOf: null, source: null };
    const series = normalizeHistoricalPairs(compare?.historical?.price);
    const latestPrice = nullableNumber(quote?.price) ?? nullableNumber(compare?.latest?.price);
    const categoryFullCode = metadata.category_fullcode ?? lineupItem.category_code ?? null;
    const categoryName = metadata.category_name ?? compare?.meta?.category ?? lineupItem.category_code ?? null;

    return {
      id: code,
      ticker: code,
      yahooSymbol: code,
      name: metadata.name ?? lineupItem.name,
      shortName: metadata.name ?? lineupItem.name,
      provider: metadata.issuer_name ?? null,
      market: '국내',
      assetClass: koreanAssetClass(categoryFullCode),
      theme: koreanTheme(categoryFullCode, categoryName),
      category: metadata.category_fullname ?? categoryName,
      benchmarkIndex: compare?.meta?.benchmark ?? null,
      currency: 'KRW',
      price: roundNullable(latestPrice, 0),
      changePercent: roundNullable(nullableNumber(quote?.return_1d)),
      expenseRatio: roundNullable(nullableNumber(compare?.tax_fee?.total_fee), 4),
      aum: nullableNumber(quote?.marketcap),
      dividendYield: roundNullable(nullableNumber(dividend?.value)),
      inceptionDate: lineupItem.listed_date ?? null,
      nav: null,
      returns: {
        m3: roundNullable(nullableNumber(price3m?.value) ?? calculatePeriodReturn(series, { months: 3 })),
        y1: roundNullable(nullableNumber(price1y?.value) ?? calculatePeriodReturn(series, { years: 1 })),
        y3Annualized: null,
        y5Annualized: null,
      },
      risk: {
        volatility3yAnnualized: null,
        maxDrawdown3y: null,
        sharpe3y: null,
        trackingError3y: null,
        informationRatio3y: null,
      },
      holdings: holdingsData.holdings,
      sparkline: normalizeSparkline(series),
      liquidity: {
        volume: nullableNumber(quote?.volume),
        tradingValue: nullableNumber(quote?.trading_value),
        marketCap: nullableNumber(quote?.marketcap),
        sourceRank: nullableNumber(quote?.rank),
      },
      dataQuality: {
        quoteAsOf: quote?.ts ?? base.quotes.trace?.latest_ts ?? GENERATED_AT,
        profileAsOf: base.price1y.trace?.asof ? `${base.price1y.trace.asof}T00:00:00.000Z` : GENERATED_AT,
        holdingsAsOf: holdingsData.asOf,
        sources: compactSources([
          { ...KETF_SOURCES.lineup, fields: ['active ETF lineup', 'name', 'listing date', 'category'] },
          { ...KETF_SOURCES.quotes, fields: ['price', 'changePercent', 'aum', 'volume', 'tradingValue'] },
          { ...KETF_SOURCES.compare, fields: ['expenseRatio', 'benchmarkIndex', '1Y history'] },
          { ...KETF_SOURCES.priceRanking3m, fields: ['returns.m3', 'issuer', 'category'] },
          { ...KETF_SOURCES.priceRanking1y, fields: ['returns.y1', 'issuer', 'category'] },
          dividend ? { ...KETF_SOURCES.dividendRanking, fields: ['dividendYield'] } : null,
          holdingsData.source,
        ]),
        missingFields: [],
      },
    };
  });
}

function supplementTicker(supplement) {
  return typeof supplement === 'string' ? supplement : supplement.ticker;
}

function supplementAliases(supplement) {
  return typeof supplement === 'string' ? [] : (supplement.aliases ?? []);
}

async function fetchUsEtfs(excluded) {
  const { records, source } = await fetchYahooMostActiveEtfs(US_MOST_ACTIVE_COUNT);
  const byTicker = new Map();
  for (const record of records) {
    const ticker = record.ticker ?? record.symbol;
    if (ticker) byTicker.set(ticker, { ...record, universeSource: source });
  }
  for (const supplement of US_CORE_SUPPLEMENTS) {
    const ticker = supplementTicker(supplement);
    const aliases = supplementAliases(supplement);
    const universeSource = {
      name: 'EIAYN US core supplement',
      url: 'https://github.com/ducklove/eiayn',
      fields: ['US core ETF supplement'],
    };

    if (byTicker.has(ticker)) {
      const existing = byTicker.get(ticker);
      byTicker.set(ticker, {
        ...existing,
        aliases: uniqueStrings([...(existing.aliases ?? []), ...aliases]),
        coreSupplement: true,
        universeSource: existing.universeSource ?? universeSource,
      });
    } else {
      byTicker.set(ticker, {
        ticker,
        symbol: ticker,
        aliases,
        coreSupplement: true,
        universeSource,
      });
    }
  }

  const recordsForFetch = Array.from(byTicker.values()).map((record, index) => ({
    ...record,
    useStockAnalysis: record.coreSupplement || index < US_STOCKANALYSIS_LIMIT,
  }));

  const etfs = await mapLimit(recordsForFetch, 6, async (record, index) => {
    if ((index + 1) % 25 === 0 || index === recordsForFetch.length - 1) {
      console.log(`[data:update] Yahoo US chart/profile ${index + 1}/${recordsForFetch.length}`);
    }
    return fetchYahooBackedEtf(record, {
      market: '미국',
      defaultCurrency: 'USD',
      useStockAnalysis: record.useStockAnalysis,
      excluded,
    });
  });

  return {
    screenerRecords: records.length,
    etfs: etfs.filter(Boolean),
  };
}

async function fetchRegionalEtfs(excluded) {
  const etfs = await mapLimit(GLOBAL_REPRESENTATIVE_ETFS, 8, async (instrument, index) => {
    if ((index + 1) % 10 === 0 || index === GLOBAL_REPRESENTATIVE_ETFS.length - 1) {
      console.log(`[data:update] Regional Yahoo chart ${index + 1}/${GLOBAL_REPRESENTATIVE_ETFS.length}`);
    }
    return fetchYahooBackedEtf({
      ticker: instrument.ticker,
      symbol: instrument.ticker,
      category: instrument.category,
      benchmarkIndex: instrument.benchmarkIndex,
      universeSource: {
        name: 'EIAYN regional representative universe',
        url: 'https://github.com/ducklove/eiayn',
        fields: ['market', 'category', 'benchmarkIndex'],
      },
    }, {
      market: instrument.market,
      defaultCurrency: defaultCurrencyForMarket(instrument.market),
      useStockAnalysis: !instrument.ticker.includes('.'),
      excluded,
    });
  });
  return etfs.filter(Boolean);
}

async function fetchYahooBackedEtf(record, options) {
  const ticker = record.ticker ?? record.symbol;
  try {
    const chart = await fetchYahooChart(ticker, '5y');
    const stockAnalysisPath = stockAnalysisPathForTicker(ticker);
    const profile = options.useStockAnalysis
      ? await fetchStockAnalysisProfile(stockAnalysisPath, chart.meta.currency ?? options.defaultCurrency)
      : emptyProfile();
    const holdings = options.useStockAnalysis
      ? await fetchStockAnalysisHoldings(stockAnalysisPath)
      : { holdings: [], source: null };

    const series = chart.series.map((point) => ({
      date: point.date,
      value: point.adjustedClose ?? point.close,
    }));
    const series3y = sliceSeriesFrom(series, { years: 3 });
    const latestQuote = chart.quotes.at(-1);
    const previousQuote = chart.quotes.at(-2);
    const price = chart.meta.regularMarketPrice ?? nullableNumber(record.regularMarketPrice) ?? latestQuote?.close ?? null;
    const changePercent = nullableNumber(record.regularMarketChangePercent)
      ?? (price && previousQuote?.close ? ((price / previousQuote.close) - 1) * 100 : null);
    const name = record.companyName ?? chart.meta.longName ?? chart.meta.shortName ?? ticker;
    const classification = classifyYahooEtf(name, record.category);

    return {
      id: ticker,
      ticker,
      yahooSymbol: ticker,
      aliases: record.aliases ?? [],
      name,
      shortName: chart.meta.shortName ?? record.shortName ?? name,
      provider: providerFromName(name),
      market: options.market,
      assetClass: classification.assetClass,
      theme: classification.theme,
      category: record.category ?? classification.category,
      benchmarkIndex: record.benchmarkIndex ?? classification.benchmarkIndex,
      currency: chart.meta.currency ?? options.defaultCurrency,
      price: roundNullable(price, zeroDecimalCurrency(chart.meta.currency ?? options.defaultCurrency) ? 0 : 2),
      changePercent: roundNullable(changePercent),
      expenseRatio: roundNullable(profile.expenseRatio ?? nullableNumber(record.netExpenseRatio) ?? nullableNumber(record.grossExpenseRatio), 4),
      aum: profile.aum ?? nullableNumber(record.fundNetAssets),
      dividendYield: roundNullable(profile.dividendYield ?? nullableNumber(record.yieldTTM) ?? trailingDividendYield(chart.dividends, price)),
      inceptionDate: profile.inceptionDate ?? chart.firstTradeDate,
      nav: null,
      returns: {
        m3: roundNullable(calculatePeriodReturn(series, { months: 3 })),
        y1: roundNullable(calculatePeriodReturn(series, { years: 1 }) ?? nullableNumber(record.annualReturnNavY1)),
        y3Annualized: roundNullable(calculateAnnualizedReturn(series, 3) ?? nullableNumber(record.annualReturnNavY3)),
        y5Annualized: roundNullable(calculateAnnualizedReturn(series, 5) ?? nullableNumber(record.annualReturnNavY5)),
      },
      risk: {
        volatility3yAnnualized: roundNullable(calculateAnnualizedVolatility(series3y)),
        maxDrawdown3y: roundNullable(calculateMaxDrawdown(series3y)),
        sharpe3y: roundNullable(calculateSharpeRatio(series3y)),
        trackingError3y: null,
        informationRatio3y: null,
      },
      holdings: holdings.holdings ?? [],
      sparkline: normalizeSparkline(series),
      liquidity: {
        volume: nullableNumber(record.regularMarketVolume) ?? latestQuote?.volume ?? null,
        tradingValue: price && (nullableNumber(record.regularMarketVolume) ?? latestQuote?.volume)
          ? roundNullable(price * (nullableNumber(record.regularMarketVolume) ?? latestQuote.volume), 0)
          : null,
        marketCap: nullableNumber(record.fundNetAssets),
        sourceRank: null,
      },
      dataQuality: {
        quoteAsOf: chart.quoteAsOf ?? GENERATED_AT,
        profileAsOf: GENERATED_AT,
        holdingsAsOf: holdings.holdings?.length ? GENERATED_AT : null,
        sources: compactSources([
          record.universeSource,
          { name: 'Yahoo Finance chart', url: chart.url, fields: ['price', 'history', 'dividends'] },
          profile.source,
          holdings.source,
        ]),
        missingFields: [],
      },
    };
  } catch (error) {
    excluded.push({ ticker, market: options.market, reason: error.message });
    console.warn(`[data:update] Excluding ${ticker}: ${error.message}`);
    return null;
  }
}

function normalizeHistoricalPairs(pairs) {
  return (pairs ?? [])
    .map(([date, value]) => ({ date, value: nullableNumber(value) }))
    .filter((point) => point.date && point.value !== null);
}

function classifyYahooEtf(name, fallbackCategory) {
  const lower = name.toLowerCase();
  if (/treasury|bond|income|aggregate|muni|mortgage|loan|high yield|tips?\b/.test(lower)) {
    return { assetClass: '채권', theme: '채권', category: fallbackCategory ?? '채권 ETF', benchmarkIndex: null };
  }
  if (/gold|silver|oil|gas|commodity|bitcoin|ether|crypto/.test(lower)) {
    return { assetClass: '대체자산', theme: '원자재/디지털자산', category: fallbackCategory ?? '대체자산 ETF', benchmarkIndex: null };
  }
  if (/bear|short|inverse/.test(lower)) {
    return { assetClass: '주식', theme: '인버스', category: fallbackCategory ?? '인버스 ETF', benchmarkIndex: null };
  }
  if (/leveraged|ultra|2x|3x|bull/.test(lower)) {
    return { assetClass: '주식', theme: '레버리지', category: fallbackCategory ?? '레버리지 ETF', benchmarkIndex: null };
  }
  if (/dividend|yield|covered call|premium income/.test(lower)) {
    return { assetClass: '주식', theme: '배당', category: fallbackCategory ?? '배당 ETF', benchmarkIndex: null };
  }
  if (/semiconductor|technology|nasdaq|software|cyber|internet|innovation|ai\b|robotics/.test(lower)) {
    return { assetClass: '주식', theme: '테크', category: fallbackCategory ?? '테크 ETF', benchmarkIndex: null };
  }
  if (/health|biotech|medical/.test(lower)) {
    return { assetClass: '주식', theme: '헬스케어', category: fallbackCategory ?? '헬스케어 ETF', benchmarkIndex: null };
  }
  if (/financial|bank/.test(lower)) {
    return { assetClass: '주식', theme: '금융', category: fallbackCategory ?? '금융 ETF', benchmarkIndex: null };
  }
  if (/energy|solar|uranium/.test(lower)) {
    return { assetClass: '주식', theme: '에너지', category: fallbackCategory ?? '에너지 ETF', benchmarkIndex: null };
  }
  if (/emerging|china|japan|india|vietnam|international|world|global/.test(lower)) {
    return { assetClass: '주식', theme: '글로벌', category: fallbackCategory ?? '글로벌 주식 ETF', benchmarkIndex: null };
  }
  return { assetClass: '주식', theme: '시장대표', category: fallbackCategory ?? '주식 ETF', benchmarkIndex: null };
}

function koreanAssetClass(fullCode) {
  if (!fullCode) return 'ETF';
  if (fullCode.startsWith('FI_')) return '채권';
  if (fullCode.startsWith('MA_')) return '혼합자산';
  if (fullCode.startsWith('CM_')) return '원자재';
  if (fullCode.startsWith('EQ_')) return '주식';
  return 'ETF';
}

function koreanTheme(fullCode, categoryName) {
  if (!fullCode && categoryName) return categoryName;
  if (!fullCode) return '기타';
  if (fullCode.includes('DIVIDEND')) return '배당';
  if (fullCode.includes('SEMICONDUCTOR')) return '반도체';
  if (fullCode.includes('AI') || fullCode.includes('ROBOTICS')) return 'AI/로봇';
  if (fullCode.includes('BATTERY')) return '2차전지';
  if (fullCode.includes('COVEREDCALL')) return '커버드콜';
  if (fullCode.includes('BOND') || fullCode.startsWith('FI_')) return '채권';
  if (fullCode.includes('MARKET')) return '시장대표';
  if (fullCode.includes('SECTOR')) return categoryName ?? '섹터';
  if (fullCode.includes('THEME')) return categoryName ?? '테마';
  return categoryName ?? '기타';
}

function providerFromName(name) {
  const patterns = [
    ['iShares', 'iShares'],
    ['Vanguard', 'Vanguard'],
    ['SPDR', 'State Street/SPDR'],
    ['State Street', 'State Street'],
    ['ProShares', 'ProShares'],
    ['Direxion', 'Direxion'],
    ['Invesco', 'Invesco'],
    ['Schwab', 'Schwab'],
    ['ARK', 'ARK Invest'],
    ['VanEck', 'VanEck'],
    ['JPMorgan', 'J.P. Morgan'],
    ['Global X', 'Global X'],
    ['First Trust', 'First Trust'],
    ['PIMCO', 'PIMCO'],
    ['WisdomTree', 'WisdomTree'],
    ['Amundi', 'Amundi'],
    ['Xtrackers', 'Xtrackers'],
    ['BetaShares', 'BetaShares'],
    ['ChinaAMC', 'ChinaAMC'],
    ['CSOP', 'CSOP'],
    ['Hang Seng', 'Hang Seng Investment'],
    ['NEXT FUNDS', 'Nomura Asset Management'],
    ['MAXIS', 'Mitsubishi UFJ Asset Management'],
    ['Daiwa', 'Daiwa Asset Management'],
    ['VFM', 'Dragon Capital/VFM'],
    ['SSIAM', 'SSIAM'],
  ];
  const found = patterns.find(([pattern]) => name.toLowerCase().includes(pattern.toLowerCase()));
  return found?.[1] ?? null;
}

function defaultCurrencyForMarket(market) {
  return ({
    홍콩: 'HKD',
    독일: 'EUR',
    프랑스: 'EUR',
    일본: 'JPY',
    호주: 'AUD',
    베트남: 'VND',
    미국: 'USD',
  })[market] ?? 'USD';
}

function zeroDecimalCurrency(currency) {
  return ['KRW', 'JPY', 'VND'].includes(currency);
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function emptyProfile() {
  return {
    source: null,
    expenseRatio: null,
    aum: null,
    dividendYield: null,
    inceptionDate: null,
  };
}

function compactSources(sources) {
  return sources.filter(Boolean).map((source) => ({
    name: source.name,
    url: source.url,
    fields: source.fields ?? [],
  }));
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupeEtfs(etfs) {
  const byId = new Map();
  for (const etf of etfs) byId.set(etf.id, etf);
  return Array.from(byId.values());
}

function sortEtfsForDisplay(a, b) {
  const marketOrder = new Map([
    ['국내', 0],
    ['미국', 1],
    ['홍콩', 2],
    ['독일', 3],
    ['프랑스', 4],
    ['일본', 5],
    ['호주', 6],
    ['베트남', 7],
  ]);
  const marketDiff = (marketOrder.get(a.market) ?? 99) - (marketOrder.get(b.market) ?? 99);
  if (marketDiff) return marketDiff;
  return (b.liquidity?.tradingValue ?? 0) - (a.liquidity?.tradingValue ?? 0);
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? '미분류';
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

main().catch((error) => {
  console.error(`[data:update] ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
