import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
import { diffSnapshots } from './data/changes.mjs';
import { buildFeedXml, changeSummaryLabel } from './data/feed.mjs';
import { appendHistoryEntry, historyFromSnapshot } from './data/history.mjs';
import {
  classifyKoreanAssetClass,
  classifyKoreanTheme,
  fetchKoreanEtfBaseData,
  koreanCategory,
  naverAnalysisUrl,
  NAVER_SOURCES,
  normalizeNaverHoldings,
  normalizeIssuerName,
  parseDeviation,
  parseNaverListedDate,
  parseNaverReferenceDate,
  periodReturn,
} from './data/naver.mjs';
import { enrichKoreanEtfsWithYahoo, KOREA_YAHOO_SOURCE_NAME } from './data/korea-enrich.mjs';
import { applyKrxNavEnrichment } from './data/krx-nav.mjs';
import {
  computeTrackingMetrics,
  resolveBenchmarkSymbol,
  trackingSourceEntry,
} from './data/benchmark-tracking.mjs';
import { buildPerformance1y, estimatePerformance1ySize } from './data/performance.mjs';
import { mapLimit } from './data/http.mjs';
import { cleanText, emptyProfile, nullableNumber } from './data/shared.mjs';
import {
  fetchExchangeRate,
  fetchYahooChart,
  fetchYahooMostActiveEtfs,
  fetchYahooQuoteSummaryProfile,
  roundNullable,
  trailingDividendYield,
  YAHOO_CHART_ROOT,
} from './data/yahoo.mjs';
import {
  fetchStockAnalysisHoldings,
  fetchStockAnalysisProfile,
  fetchStockAnalysisQuoteProfile,
  stockAnalysisPathForTicker,
} from './data/stockanalysis.mjs';
import { profileOverrideForTicker } from './data/profile-overrides.mjs';
import { buildSourceCatalog } from './data/source-catalog.mjs';
import { GLOBAL_REPRESENTATIVE_ETFS, US_CORE_SUPPLEMENTS } from './data/universe.mjs';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'data');
const OUT_FILE = path.join(OUT_DIR, 'etfs.json');
const HISTORY_FILE = path.join(OUT_DIR, 'history.json');
const CHANGES_FILE = path.join(OUT_DIR, 'changes.json');
const FEED_FILE = path.join(OUT_DIR, 'feed.xml');
const GENERATED_AT = new Date().toISOString();
const US_MOST_ACTIVE_COUNT = Number(process.env.US_MOST_ACTIVE_COUNT ?? 150);
const US_STOCKANALYSIS_LIMIT = Number(process.env.US_STOCKANALYSIS_LIMIT ?? 40);
// Optional partial-run knob: when set, only the top-N Korean ETFs by trading
// value get the Yahoo KRX long-horizon enrichment. Default: all Korean ETFs.
const KOREA_YAHOO_LIMIT = nullableNumber(process.env.KOREA_YAHOO_LIMIT);

// Benchmark index series are fetched lazily and at most once per Yahoo symbol
// (~21 symbols cover every mappable benchmarkIndex). A failed fetch caches
// null so tracking metrics simply stay null for the affected ETFs.
const benchmarkSeriesPromises = new Map();

function benchmarkForIndex(benchmarkIndex) {
  const symbol = resolveBenchmarkSymbol(benchmarkIndex);
  if (!symbol) return Promise.resolve(null);
  if (!benchmarkSeriesPromises.has(symbol)) {
    benchmarkSeriesPromises.set(
      symbol,
      fetchYahooChart(symbol, '3y', { attempts: 2, warn: false })
        .then((chart) =>
          chart.series.map((point) => ({
            date: point.date,
            value: point.adjustedClose ?? point.close,
          })),
        )
        .catch((error) => {
          console.warn(`[data:update] Benchmark series unavailable ${symbol}: ${error.message}`);
          return null;
        }),
    );
  }
  return benchmarkSeriesPromises.get(symbol).then((series) => (series ? { symbol, series } : null));
}

async function main() {
  const excluded = [];

  console.log('[data:update] Collecting Korea ETF universe from Naver Finance');
  const koreanBase = await fetchKoreanEtfBaseData();
  const koreaBaseEtfs = buildKoreanEtfs(koreanBase, excluded);
  console.log(
    `[data:update] Korea ETFs normalized: ${koreaBaseEtfs.length}/${koreanBase.lineup.length}`,
  );

  // Best-effort long-horizon enrichment from Yahoo KRX charts. Each chart
  // fetch is optional: failures leave the ETF unchanged and never abort the run.
  const koreaEtfs = await enrichKoreanEtfsWithYahoo(koreaBaseEtfs, {
    fetchChart: (symbol) => fetchYahooChart(symbol, '5y', { attempts: 2, warn: false }),
    fetchBenchmark: (etf) => benchmarkForIndex(etf.benchmarkIndex),
    limit: KOREA_YAHOO_LIMIT,
    concurrency: 6,
  });

  console.log(`[data:update] Collecting Yahoo most active US ETFs (${US_MOST_ACTIVE_COUNT})`);
  const usData = await fetchUsEtfs(excluded);
  console.log(`[data:update] US ETFs normalized: ${usData.etfs.length}`);

  console.log('[data:update] Collecting regional representative ETFs');
  const regionalEtfs = await fetchRegionalEtfs(excluded);
  console.log(`[data:update] Regional ETFs normalized: ${regionalEtfs.length}`);

  // Korean nav/premiumDiscount now come from Naver inside buildKoreanEtfs.
  // Applying the (empty-map) KRX enrichment pass keeps the snapshot-wide
  // invariant that premiumDiscount: null exists on every non-Korean ETF.
  const etfs = applyKrxNavEnrichment(
    dedupeEtfs([...koreaEtfs, ...usData.etfs, ...regionalEtfs]).sort(sortEtfsForDisplay),
    new Map(),
  );

  const scoredEtfs = scoreEtfs(etfs).map((etf) => ({
    ...etf,
    dataQuality: {
      ...etf.dataQuality,
      missingFields: collectMissingFields(etf),
    },
  }));

  const performanceSize = estimatePerformance1ySize(scoredEtfs);
  console.log(
    `[data:update] performance1y: ${performanceSize.etfsWithSeries}/${scoredEtfs.length} ETFs, ~${(performanceSize.bytes / 1024).toFixed(1)} KiB serialized`,
  );

  const usdKrw = await fetchExchangeRate();
  const marketCounts = countBy(scoredEtfs, 'market');
  // Schema v2: per-ETF code above keeps producing inline source objects;
  // this single pass dedupes them into a top-level catalog and replaces each
  // ETF's dataQuality.sources with dataQuality.sourceRefs (catalog indexes).
  const { catalog: sourceCatalog, etfsWithRefs } = buildSourceCatalog(scoredEtfs);
  const payload = {
    schemaVersion: 2,
    generatedAt: GENERATED_AT,
    timezone: 'Asia/Seoul',
    universe: scoredEtfs.map((etf) => etf.id),
    coverage: {
      korea: {
        sourceTotal: koreanBase.lineup.length,
        included: koreaEtfs.length,
        quoteAsOf: GENERATED_AT,
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
        name: NAVER_SOURCES.lineup.name,
        url: 'https://finance.naver.com/sise/etf.naver',
        fields: [
          'Korea ETF lineup',
          'price',
          'changePercent',
          'volume',
          'trading value',
          'market cap',
        ],
      },
      {
        name: NAVER_SOURCES.analysis.name,
        url: 'https://m.stock.naver.com/',
        fields: [
          'issuer',
          'total fee',
          'base index',
          'listing date',
          'NAV',
          'premium/discount',
          '3M/1Y returns',
          'dividend yield',
          'top-10 holdings',
        ],
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
        name: KOREA_YAHOO_SOURCE_NAME,
        url: YAHOO_CHART_ROOT,
        fields: [
          'Korea ETF 3y/5y returns',
          'Korea ETF 3y risk metrics',
          'dividendYield, sparkline, and performance1y fallback',
        ],
      },
      {
        name: 'StockAnalysis',
        url: 'https://stockanalysis.com/',
        fields: [
          'expenseRatio',
          'aum',
          'dividendYield',
          'inceptionDate',
          'holdings',
          'regional quote profile',
        ],
      },
      {
        name: 'Yahoo Finance quoteSummary',
        url: 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/',
        fields: ['regional expenseRatio', 'aum', 'dividendYield', 'inceptionDate'],
      },
      {
        name: 'Issuer or exchange profile override',
        url: 'https://github.com/ducklove/eiayn/blob/main/scripts/data/profile-overrides.mjs',
        fields: [
          'manually curated expenseRatio for regional ETFs, applied with highest precedence',
        ],
      },
      {
        name: 'EIAYN regional representative universe',
        url: 'https://github.com/ducklove/eiayn',
        fields: ['regional representative ETF selection', 'market classification'],
      },
    ],
    sourceCatalog,
    exchangeRates: {
      usdKrw,
    },
    etfs: etfsWithRefs,
  };

  // History & changes artifacts: read the previous snapshot and sidecar files
  // BEFORE overwriting anything, then derive the rolling score history, the
  // day-over-day diff, and the RSS feed. Every step is non-fatal: a missing or
  // corrupt previous file logs a warning and degrades (diff against null,
  // fresh history/feed) but never aborts the refresh.
  const previousSnapshot = await readJsonOrNull(OUT_FILE);
  const previousHistory = await readJsonOrNull(HISTORY_FILE);
  const previousFeedXml = await readTextOrNull(FEED_FILE);
  let sidecarFiles = [];
  try {
    sidecarFiles = buildSidecarFiles({
      previousSnapshot,
      previousHistory,
      previousFeedXml,
      payload,
    });
  } catch (error) {
    console.warn(`[data:update] history/changes artifacts skipped: ${error.message}`);
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[data:update] Wrote ${path.relative(ROOT, OUT_FILE)} (${scoredEtfs.length} ETFs)`);

  for (const sidecar of sidecarFiles) {
    try {
      await writeFile(sidecar.file, sidecar.contents, 'utf8');
      console.log(`[data:update] Wrote ${path.relative(ROOT, sidecar.file)} (${sidecar.label})`);
    } catch (error) {
      console.warn(`[data:update] Skipped ${path.relative(ROOT, sidecar.file)}: ${error.message}`);
    }
  }
}

// Derives the three sidecar artifacts for a refresh run. Each artifact is
// computed independently so one failure (which would indicate a bug, not bad
// upstream data) only costs that artifact, never the snapshot itself.
function buildSidecarFiles({ previousSnapshot, previousHistory, previousFeedXml, payload }) {
  const files = [];

  try {
    const history = appendHistoryEntry(previousHistory, historyFromSnapshot(payload));
    const today = history.entries.at(-1);
    files.push({
      file: HISTORY_FILE,
      contents: `${JSON.stringify(history)}\n`,
      label: `${history.entries.length} days, ${Object.keys(today.scores).length} scores on ${today.date}`,
    });
  } catch (error) {
    console.warn(`[data:update] history.json skipped: ${error.message}`);
  }

  try {
    const changes = diffSnapshots(previousSnapshot, payload);
    files.push({
      file: CHANGES_FILE,
      contents: `${JSON.stringify(changes, null, 2)}\n`,
      label: changeSummaryLabel(changes),
    });
    try {
      files.push({
        file: FEED_FILE,
        contents: buildFeedXml(previousFeedXml, changes),
        label: 'RSS',
      });
    } catch (error) {
      console.warn(`[data:update] feed.xml skipped: ${error.message}`);
    }
  } catch (error) {
    console.warn(`[data:update] changes.json and feed.xml skipped: ${error.message}`);
  }

  return files;
}

async function readJsonOrNull(file) {
  const raw = await readTextOrNull(file);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[data:update] Ignoring corrupt ${path.relative(ROOT, file)}: ${error.message}`);
    return null;
  }
}

async function readTextOrNull(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(
        `[data:update] Ignoring unreadable ${path.relative(ROOT, file)}: ${error.message}`,
      );
    }
    return null;
  }
}

function buildKoreanEtfs(base, excluded = []) {
  // Trading-value rank across the lineup (1 = highest). Replaces the K-ETF
  // quote rank; only used as an informational liquidity field.
  const rankByCode = new Map(
    [...base.lineup]
      .sort((a, b) => (nullableNumber(b.amonut) ?? 0) - (nullableNumber(a.amonut) ?? 0))
      .map((item, index) => [item.itemcode, index + 1]),
  );

  return base.lineup.flatMap((item) => {
    const code = item.itemcode;
    const analysis = base.analyses.get(code) ?? null;
    const analysisUrl = naverAnalysisUrl(code);
    const price = nullableNumber(item.nowVal);
    if (price === null || price <= 0) {
      const reason = 'missing price from Naver ETF lineup';
      excluded.push({ ticker: code, market: '국내', reason });
      console.warn(`[data:update] Excluding ${code}: ${reason}`);
      return [];
    }

    const name = cleanText(analysis?.itemName) || cleanText(item.itemname) || code;
    const benchmarkIndex = cleanText(analysis?.etfBaseIndex) || null;
    const assetClass = classifyKoreanAssetClass({
      name,
      baseIndex: benchmarkIndex ?? '',
      tabCode: nullableNumber(item.etfTabCode),
    });
    const theme = classifyKoreanTheme({
      name,
      baseIndex: benchmarkIndex ?? '',
      themeMiddle: analysis?.themeReturns?.themeMiddleCodeDesc ?? '',
      assetClass,
    });
    const holdingsData = normalizeNaverHoldings(analysis, analysisUrl);
    // Official previous-trading-day NAV from the analysis endpoint; the
    // lineup's live iNAV is the fallback. Both must be positive to be used.
    const nav = nullableNumber(analysis?.nav) ?? nullableNumber(item.nav);
    const navAsOf = parseNaverReferenceDate(analysis?.navPerformanceReferenceDate);
    // Naver units: amonut is 백만원, marketSum is 억원; snapshot stores raw KRW.
    const tradingValue = scaleNullable(nullableNumber(item.amonut), 1_000_000);
    const marketCap = scaleNullable(nullableNumber(item.marketSum), 100_000_000);

    return [
      {
        id: code,
        ticker: code,
        yahooSymbol: code,
        name,
        shortName: name,
        provider: normalizeIssuerName(analysis?.issuerName),
        market: '국내',
        assetClass,
        theme,
        category: koreanCategory({ assetClass, theme }),
        benchmarkIndex,
        currency: 'KRW',
        price: roundNullable(price, 0),
        changePercent: roundNullable(nullableNumber(item.changeRate)),
        expenseRatio: roundNullable(nullableNumber(analysis?.totalFee), 4),
        aum: marketCap,
        dividendYield: roundNullable(nullableNumber(analysis?.dividend?.dividendYieldTtm)),
        inceptionDate: parseNaverListedDate(analysis?.listedDate),
        nav: nav !== null && nav > 0 ? nav : null,
        premiumDiscount: parseDeviation(analysis),
        returns: {
          m3: roundNullable(
            periodReturn(analysis, 'M3') ?? nullableNumber(item.threeMonthEarnRate),
          ),
          y1: roundNullable(periodReturn(analysis, 'Y1')),
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
        // Long-horizon series fields are filled by the Yahoo KRX enrichment.
        sparkline: [],
        performance1y: null,
        liquidity: {
          volume: nullableNumber(item.quant),
          tradingValue,
          marketCap,
          sourceRank: rankByCode.get(code) ?? null,
        },
        dataQuality: {
          quoteAsOf: GENERATED_AT,
          profileAsOf: GENERATED_AT,
          holdingsAsOf: null,
          ...(nav !== null && nav > 0 && navAsOf ? { navAsOf } : {}),
          sources: compactSources([
            {
              ...NAVER_SOURCES.lineup,
              fields: ['lineup', 'price', 'changePercent', 'volume', 'tradingValue', 'marketCap'],
            },
            analysis
              ? {
                  name: NAVER_SOURCES.analysis.name,
                  url: analysisUrl,
                  fields: [
                    'provider',
                    'expenseRatio',
                    'benchmarkIndex',
                    'inceptionDate',
                    'nav',
                    'premiumDiscount',
                    'returns.m3',
                    'returns.y1',
                    'dividendYield',
                  ],
                }
              : null,
            holdingsData.source,
          ]),
          missingFields: [],
        },
      },
    ];
  });
}

function scaleNullable(value, factor) {
  return value === null ? null : value * factor;
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
      console.log(
        `[data:update] Regional Yahoo chart ${index + 1}/${GLOBAL_REPRESENTATIVE_ETFS.length}`,
      );
    }
    return fetchYahooBackedEtf(
      {
        ticker: instrument.ticker,
        symbol: instrument.ticker,
        category: instrument.category,
        benchmarkIndex: instrument.benchmarkIndex,
        universeSource: {
          name: 'EIAYN regional representative universe',
          url: 'https://github.com/ducklove/eiayn',
          fields: ['market', 'category', 'benchmarkIndex'],
        },
      },
      {
        market: instrument.market,
        defaultCurrency: defaultCurrencyForMarket(instrument.market),
        useStockAnalysis: !instrument.ticker.includes('.'),
        useRegionalProfile: true,
        useYahooQuoteSummaryProfile: true,
        excluded,
      },
    );
  });
  return etfs.filter(Boolean);
}

async function fetchYahooBackedEtf(record, options) {
  const ticker = record.ticker ?? record.symbol;
  try {
    const chart = await fetchYahooChart(ticker, '5y');
    const stockAnalysisPath = stockAnalysisPathForTicker(ticker);
    const profileCurrency = chart.meta.currency ?? options.defaultCurrency;
    const stockAnalysisProfile = options.useStockAnalysis
      ? await fetchStockAnalysisProfile(
          stockAnalysisPath,
          chart.meta.currency ?? options.defaultCurrency,
        )
      : emptyProfile();
    const regionalProfile = options.useRegionalProfile
      ? await fetchStockAnalysisQuoteProfile(ticker, profileCurrency)
      : emptyProfile();
    const yahooQuoteSummaryProfile = options.useYahooQuoteSummaryProfile
      ? await fetchYahooQuoteSummaryProfile(ticker)
      : emptyProfile();
    // mergeProfiles is first-non-null-wins, so manually curated overrides
    // must come first to take precedence over scraped values.
    const profile = mergeProfiles([
      profileOverrideForTicker(ticker),
      stockAnalysisProfile,
      regionalProfile,
      yahooQuoteSummaryProfile,
    ]);
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
    const price =
      chart.meta.regularMarketPrice ??
      nullableNumber(record.regularMarketPrice) ??
      latestQuote?.close ??
      null;
    const changePercent =
      nullableNumber(record.regularMarketChangePercent) ??
      (price && previousQuote?.close ? (price / previousQuote.close - 1) * 100 : null);
    const name = record.companyName ?? chart.meta.longName ?? chart.meta.shortName ?? ticker;
    const classification = classifyYahooEtf(name, record.category);
    const benchmark = await benchmarkForIndex(
      record.benchmarkIndex ?? classification.benchmarkIndex,
    );
    const tracking = benchmark
      ? computeTrackingMetrics(series3y, benchmark.series)
      : { trackingError3y: null, informationRatio3y: null };

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
      price: roundNullable(
        price,
        zeroDecimalCurrency(chart.meta.currency ?? options.defaultCurrency) ? 0 : 2,
      ),
      changePercent: roundNullable(changePercent),
      expenseRatio: roundNullable(
        profile.expenseRatio ??
          nullableNumber(record.netExpenseRatio) ??
          nullableNumber(record.grossExpenseRatio),
        4,
      ),
      aum: profile.aum ?? nullableNumber(record.fundNetAssets),
      dividendYield: roundNullable(
        profile.dividendYield ??
          nullableNumber(record.yieldTTM) ??
          trailingDividendYield(chart.dividends, price),
      ),
      inceptionDate: profile.inceptionDate ?? chart.firstTradeDate,
      nav: null,
      returns: {
        m3: roundNullable(calculatePeriodReturn(series, { months: 3 })),
        y1: roundNullable(
          calculatePeriodReturn(series, { years: 1 }) ?? nullableNumber(record.annualReturnNavY1),
        ),
        y3Annualized: roundNullable(
          calculateAnnualizedReturn(series, 3) ?? nullableNumber(record.annualReturnNavY3),
        ),
        y5Annualized: roundNullable(
          calculateAnnualizedReturn(series, 5) ?? nullableNumber(record.annualReturnNavY5),
        ),
      },
      risk: {
        volatility3yAnnualized: roundNullable(calculateAnnualizedVolatility(series3y)),
        maxDrawdown3y: roundNullable(calculateMaxDrawdown(series3y)),
        sharpe3y: roundNullable(calculateSharpeRatio(series3y)),
        trackingError3y: tracking.trackingError3y,
        informationRatio3y: tracking.informationRatio3y,
      },
      holdings: holdings.holdings ?? [],
      sparkline: normalizeSparkline(series),
      performance1y: buildPerformance1y(series),
      liquidity: {
        volume: nullableNumber(record.regularMarketVolume) ?? latestQuote?.volume ?? null,
        tradingValue:
          price && (nullableNumber(record.regularMarketVolume) ?? latestQuote?.volume)
            ? roundNullable(
                price * (nullableNumber(record.regularMarketVolume) ?? latestQuote.volume),
                0,
              )
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
          {
            name: 'Yahoo Finance chart',
            url: chart.url,
            fields: ['price', 'history', 'dividends', 'performance1y'],
          },
          tracking.trackingError3y !== null ? trackingSourceEntry(benchmark.symbol) : null,
          ...(profile.sources ?? [profile.source]),
          holdings.source,
        ]),
        missingFields: [],
      },
    };
  } catch (error) {
    options.excluded.push({ ticker, market: options.market, reason: error.message });
    console.warn(`[data:update] Excluding ${ticker}: ${error.message}`);
    return null;
  }
}

function classifyYahooEtf(name, fallbackCategory) {
  const lower = name.toLowerCase();
  if (/treasury|bond|income|aggregate|muni|mortgage|loan|high yield|tips?\b/.test(lower)) {
    return {
      assetClass: '채권',
      theme: '채권',
      category: fallbackCategory ?? '채권 ETF',
      benchmarkIndex: null,
    };
  }
  if (/gold|silver|oil|gas|commodity|bitcoin|ether|crypto/.test(lower)) {
    return {
      assetClass: '대체자산',
      theme: '원자재/디지털자산',
      category: fallbackCategory ?? '대체자산 ETF',
      benchmarkIndex: null,
    };
  }
  if (/bear|short|inverse/.test(lower)) {
    return {
      assetClass: '주식',
      theme: '인버스',
      category: fallbackCategory ?? '인버스 ETF',
      benchmarkIndex: null,
    };
  }
  if (/leveraged|ultra|2x|3x|bull/.test(lower)) {
    return {
      assetClass: '주식',
      theme: '레버리지',
      category: fallbackCategory ?? '레버리지 ETF',
      benchmarkIndex: null,
    };
  }
  if (/dividend|yield|covered call|premium income/.test(lower)) {
    return {
      assetClass: '주식',
      theme: '배당',
      category: fallbackCategory ?? '배당 ETF',
      benchmarkIndex: null,
    };
  }
  if (
    /semiconductor|technology|nasdaq|software|cyber|internet|innovation|ai\b|robotics/.test(lower)
  ) {
    return {
      assetClass: '주식',
      theme: '테크',
      category: fallbackCategory ?? '테크 ETF',
      benchmarkIndex: null,
    };
  }
  if (/health|biotech|medical/.test(lower)) {
    return {
      assetClass: '주식',
      theme: '헬스케어',
      category: fallbackCategory ?? '헬스케어 ETF',
      benchmarkIndex: null,
    };
  }
  if (/financial|bank/.test(lower)) {
    return {
      assetClass: '주식',
      theme: '금융',
      category: fallbackCategory ?? '금융 ETF',
      benchmarkIndex: null,
    };
  }
  if (/energy|solar|uranium/.test(lower)) {
    return {
      assetClass: '주식',
      theme: '에너지',
      category: fallbackCategory ?? '에너지 ETF',
      benchmarkIndex: null,
    };
  }
  if (/emerging|china|japan|india|vietnam|international|world|global/.test(lower)) {
    return {
      assetClass: '주식',
      theme: '글로벌',
      category: fallbackCategory ?? '글로벌 주식 ETF',
      benchmarkIndex: null,
    };
  }
  return {
    assetClass: '주식',
    theme: '시장대표',
    category: fallbackCategory ?? '주식 ETF',
    benchmarkIndex: null,
  };
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
  return (
    {
      홍콩: 'HKD',
      독일: 'EUR',
      프랑스: 'EUR',
      일본: 'JPY',
      호주: 'AUD',
      베트남: 'VND',
      미국: 'USD',
    }[market] ?? 'USD'
  );
}

function zeroDecimalCurrency(currency) {
  return ['KRW', 'JPY', 'VND'].includes(currency);
}

function mergeProfiles(profiles) {
  const merged = emptyProfile();
  const sources = [];
  for (const profile of profiles) {
    if (!profile) continue;
    for (const key of ['expenseRatio', 'aum', 'dividendYield', 'inceptionDate']) {
      if (
        (merged[key] === null || merged[key] === undefined) &&
        profile[key] !== null &&
        profile[key] !== undefined
      ) {
        merged[key] = profile[key];
      }
    }
    if (profile.source) sources.push(profile.source);
    if (Array.isArray(profile.sources)) sources.push(...profile.sources);
  }

  return {
    ...merged,
    source: sources[0] ?? null,
    sources: dedupeSources(sources),
  };
}

function compactSources(sources) {
  return sources.filter(Boolean).map((source) => ({
    name: source.name,
    url: source.url,
    fields: source.fields ?? [],
  }));
}

function dedupeSources(sources) {
  const byKey = new Map();
  for (const source of sources.filter(Boolean)) {
    byKey.set(`${source.name}|${source.url}`, source);
  }
  return Array.from(byKey.values());
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
