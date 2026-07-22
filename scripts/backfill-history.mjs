// One-off (rerunnable) backfill of public/data/history.json for refresh-outage
// gaps — written for the 2026-06-26..2026-07-21 outage caused by the K-ETF /
// KRX source shutdowns.
//
// For every Seoul weekday in the gap that has no history entry yet, the script
// reconstructs that day's AIYN scores by re-running the production scorer
// (src/lib/scoring.js) over the snapshot universe with every price-derived
// input recomputed from the Yahoo chart series truncated at that day:
// sparkline (30d), returns m3/y1/y3/y5, risk volatility/MDD/sharpe (3y), and
// benchmark tracking metrics. Slow-moving inputs the pipeline cannot observe
// retroactively — expense ratio, AUM, holdings concentration — are held at
// their current snapshot values.
//
// Honesty rules:
// - Only ETFs whose Yahoo series actually covers the target day are scored;
//   ETFs without a usable chart are omitted from backfilled entries entirely
//   (missing data stays missing — no static-only pseudo-scores).
// - Backfilled entries carry `backfilled: true` (preserved by
//   scripts/data/history.mjs across later appends) so the UI/consumers can
//   distinguish reconstructed points from live daily observations.
// - Live entries are never modified or replaced; a rerun may replace
//   earlier backfilled entries with an improved reconstruction.
//
// Usage: node scripts/backfill-history.mjs [--from 2026-06-26] [--to 2026-07-21]

import { readFile, writeFile } from 'node:fs/promises';
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
import { scoreEtfs } from '../src/lib/scoring.js';
import { appendHistoryEntry } from './data/history.mjs';
import { computeTrackingMetrics, resolveBenchmarkSymbol } from './data/benchmark-tracking.mjs';
import { mapLimit } from './data/http.mjs';
import { fetchYahooChart } from './data/yahoo.mjs';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'etfs.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
// 10y first so the 5-year return window is fully covered as of every gap
// day; Yahoo rejects long ranges for shorter-lived symbols, so fall back to
// 5y (the main pipeline's proven range — the 5y-minus-gap window it implies
// matches the pipeline's own inclusive-boundary tolerance).
const CHART_RANGES = ['10y', '5y'];
const CHART_CONCURRENCY = 6;

async function fetchChartSeries(symbol) {
  for (const range of CHART_RANGES) {
    try {
      const chart = await fetchYahooChart(symbol, range, { attempts: 2, warn: false });
      const series = chart.series
        .map((point) => ({ date: point.date, value: point.adjustedClose ?? point.close }))
        .filter((point) => point.value !== null && point.value !== undefined);
      if (series.length >= 2) return series;
    } catch {
      // Try the shorter range, or give up silently (best-effort).
    }
  }
  return null;
}

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const FROM = argValue('--from', '2026-06-26');
const TO = argValue('--to', '2026-07-21');
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
if (!DATE_PATTERN.test(FROM) || !DATE_PATTERN.test(TO) || FROM > TO) {
  console.error(`[backfill] invalid range --from ${FROM} --to ${TO}`);
  process.exit(1);
}

/** Seoul-calendar weekdays (KRX trading days minus holidays) in [from, to]. */
function weekdaysBetween(from, to) {
  const days = [];
  for (
    let time = Date.parse(`${from}T00:00:00Z`);
    time <= Date.parse(`${to}T00:00:00Z`);
    time += 86_400_000
  ) {
    const date = new Date(time);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

function truncateSeries(series, date) {
  return series.filter((point) => point.date <= date);
}

async function main() {
  const snapshot = JSON.parse(await readFile(SNAPSHOT_FILE, 'utf8'));
  const history = JSON.parse(await readFile(HISTORY_FILE, 'utf8'));
  // Live entries are never touched; a rerun may replace earlier backfilled
  // entries (e.g. after improving the reconstruction).
  const liveDates = new Set(
    (history.entries ?? []).filter((entry) => entry.backfilled !== true).map((entry) => entry.date),
  );
  const targetDates = weekdaysBetween(FROM, TO).filter((date) => !liveDates.has(date));
  if (!targetDates.length) {
    console.log('[backfill] nothing to do: every weekday in range has a live entry');
    return;
  }
  console.log(`[backfill] target days: ${targetDates.join(', ')}`);

  // One chart per ETF (best-effort) and one per mapped benchmark symbol.
  const etfs = snapshot.etfs ?? [];
  const seriesById = new Map();
  let fetched = 0;
  await mapLimit(etfs, CHART_CONCURRENCY, async (etf) => {
    const series = await fetchChartSeries(etf.yahooSymbol ?? etf.ticker);
    if (series) seriesById.set(etf.id, series);
    fetched += 1;
    if (fetched % 250 === 0 || fetched === etfs.length) {
      console.log(`[backfill] charts ${fetched}/${etfs.length} (${seriesById.size} usable)`);
    }
  });

  const benchmarkSeries = new Map();
  const benchmarkSymbols = new Set(
    etfs.map((etf) => resolveBenchmarkSymbol(etf.benchmarkIndex)).filter(Boolean),
  );
  await mapLimit([...benchmarkSymbols], 4, async (symbol) => {
    const series = await fetchChartSeries(symbol);
    if (series) benchmarkSeries.set(symbol, series);
    // On total failure, tracking metrics stay null for ETFs on this benchmark.
  });
  console.log(
    `[backfill] benchmarks: ${benchmarkSeries.size}/${benchmarkSymbols.size} series available`,
  );

  const generatedAt = new Date().toISOString();
  let nextHistory = history;
  for (const date of targetDates) {
    const dayEtfs = [];
    for (const etf of etfs) {
      const fullSeries = seriesById.get(etf.id);
      if (!fullSeries) continue;
      const series = truncateSeries(fullSeries, date);
      if (series.length < 2) continue;
      // The chart must actually observe the day (within a week: charts skip
      // exchange holidays), otherwise the "as of" claim would be false.
      if (series.at(-1).date < shiftDays(date, -7)) continue;
      const series3y = sliceSeriesFrom(series, { years: 3 });
      const symbol = resolveBenchmarkSymbol(etf.benchmarkIndex);
      const benchmark = symbol ? benchmarkSeries.get(symbol) : null;
      const tracking = benchmark
        ? computeTrackingMetrics(series3y, truncateSeries(benchmark, date))
        : { trackingError3y: null, informationRatio3y: null };

      dayEtfs.push({
        id: etf.id,
        expenseRatio: etf.expenseRatio,
        aum: etf.aum,
        holdings: etf.holdings,
        sparkline: normalizeSparkline(series),
        returns: {
          m3: calculatePeriodReturn(series, { months: 3 }),
          y1: calculatePeriodReturn(series, { years: 1 }),
          y3Annualized: calculateAnnualizedReturn(series, 3),
          y5Annualized: calculateAnnualizedReturn(series, 5),
        },
        risk: {
          volatility3yAnnualized: calculateAnnualizedVolatility(series3y),
          maxDrawdown3y: calculateMaxDrawdown(series3y),
          sharpe3y: calculateSharpeRatio(series3y),
          trackingError3y: tracking.trackingError3y,
          informationRatio3y: tracking.informationRatio3y,
        },
      });
    }

    const scores = {};
    for (const scored of scoreEtfs(dayEtfs)) {
      if (typeof scored.aiynScore === 'number' && Number.isFinite(scored.aiynScore)) {
        scores[scored.id] = Math.round(scored.aiynScore);
      }
    }
    console.log(`[backfill] ${date}: ${Object.keys(scores).length} scores`);
    nextHistory = appendHistoryEntry(nextHistory, { date, generatedAt, scores, backfilled: true });
  }

  await writeFile(HISTORY_FILE, `${JSON.stringify(nextHistory)}\n`, 'utf8');
  console.log(
    `[backfill] wrote ${path.relative(ROOT, HISTORY_FILE)} (${nextHistory.entries.length} entries)`,
  );
}

function shiftDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

main().catch((error) => {
  console.error(`[backfill] ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
