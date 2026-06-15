# Data Sources

EIAYN is designed for GitHub Pages static hosting. The browser does not call external finance APIs. Instead, `scripts/fetch-etf-data.mjs` fetches public data at build time and writes `public/data/etfs.json`.

## Source Summary

| Source | URL | Fields |
| --- | --- | --- |
| K-ETF | `https://www.k-etf.com/` and `https://anchor.k-etf.com/api/` | Korea active ETF lineup, price, 1-day return, volume, trading value, market cap, category, issuer when available, 3M/1Y returns, total fee, 1Y history, top holdings |
| Yahoo Finance MOST_ACTIVES_ETFS screener | `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved` | US high-volume ETF universe, US ETF price, volume, AUM, expense ratio where available |
| Yahoo Finance chart | `https://query1.finance.yahoo.com/v8/finance/chart/` | price, adjusted-close history, dividend events, quote timestamp, listed-symbol currency, USD/KRW; Korea KRX `.KS` charts for 3-year/5-year enrichment |
| Yahoo Finance quoteSummary | `https://query2.finance.yahoo.com/v10/finance/quoteSummary/` | regional ETF profile fallback for expense ratio, AUM, dividend yield, inception date |
| StockAnalysis | `https://stockanalysis.com/` | US ETF expense ratio, assets/AUM, dividend yield, inception date, top holdings where available; regional quote profile fields where available |
| KRX 정보데이터시스템 | `http://data.krx.co.kr/` | Korean ETF NAV and premium/discount (괴리율) from one batched 'ETF 전종목 시세' request per refresh, strictly best-effort |
| Issuer or exchange profile override | `scripts/data/profile-overrides.mjs` | narrowly scoped, manually curated expense ratio values for regional ETFs, applied with highest precedence over scraped values |
| EIAYN regional representative universe | `https://github.com/ducklove/eiayn` | regional representative ETF selection and market classification |

## Snapshot Schema v2 (source catalog)

`public/data/etfs.json` carries `schemaVersion: 2`. In schema v1 every ETF embedded its own `dataQuality.sources` array of `{ name, url, fields }` attribution objects; because most of those objects are identical across ETFs, roughly 30% of the payload was repeated attribution data (8,359 inline entries for 1,348 ETFs, only 1,578 distinct). Schema v2 normalizes them:

- A top-level `sourceCatalog` array lists each distinct source once as `{ name, url, fields }` (dedupe key: name + url + fields, with field order significant), in first-seen order.
- Each ETF's `dataQuality.sourceRefs` is an array of integer indexes into `sourceCatalog`, replacing the v1 `dataQuality.sources` array. `quoteAsOf`, `profileAsOf`, `holdingsAsOf`, and `missingFields` are unchanged.
- The small human-readable top-level `sources` array describing the overall pipeline is unchanged.

The pipeline still produces inline source objects per ETF internally; `scripts/data/source-catalog.mjs` dedupes them in a single pass right before the payload is written. `node scripts/migrate-snapshot.mjs` exists for the one-time migration of a v1 snapshot to v2 (idempotent: a v2 file is left untouched), and `npm run check:data` enforces `schemaVersion === 2`, the catalog shape, and that every `sourceRefs` entry is a valid catalog index.

## Korea Collection

Korean ETF coverage starts from K-ETF active instruments:

```text
https://anchor.k-etf.com/api/instrument/instruments/?lang=ko&status=active&type=etf
```

The build then joins:

- `timeseries/instrument-return` for current price, market cap, volume, and trading value.
- `instrument/ranking` for 3-month and 1-year price returns plus dividend return.
- `instrument/compare` in 200-code batches for total fee, benchmark code, and 1-year historical price series.
- `instrument/holdings` for top holdings (up to 25 per ETF; the AIYN diversification factor still uses top-10 concentration).

The current snapshot includes active K-ETF records returned by the source only after a usable numeric price is available from the K-ETF quote or compare data. Newly listed or temporary records that K-ETF lists before publishing a price are excluded from the production snapshot, logged in `coverage.excluded`, and counted against `coverage.korea.sourceTotal` during validation so one incomplete listing cannot block the whole daily refresh. If K-ETF exposes a non-critical field for only part of the included universe, the missing field remains `null` or an empty array and is listed in `dataQuality.missingFields`.

### Yahoo KRX long-horizon enrichment

K-ETF batch history covers only one year, so after the K-ETF build each Korean ETF is optionally enriched from the Yahoo Finance chart for its KRX symbol (`${code}.KS`, 5-year range). K-ETF values always keep priority: the enrichment fills only fields that are still `null` after the K-ETF build.

- `returns.y3Annualized` and `returns.y5Annualized` computed from the Yahoo adjusted-close series.
- `risk.volatility3yAnnualized`, `risk.maxDrawdown3y`, and `risk.sharpe3y` computed over the latest 3-year window, using the same formulas as US/regional ETFs.
- `returns.m3`, `returns.y1`, `dividendYield`, `sparkline`, and `performance1y` only as fallbacks when K-ETF left them empty.

When an ETF is enriched, `yahooSymbol` is set to the `.KS` symbol and a `Yahoo Finance chart (KRX)` source entry is appended listing exactly the fields that were filled (stored in the written snapshot as a `dataQuality.sourceRefs` index into `sourceCatalog`). The `KOREA_YAHOO_LIMIT` environment variable restricts enrichment to the top-N Korean ETFs by trading value for partial CI or local runs; by default all Korean ETFs are attempted.

### KRX NAV / premium-discount enrichment

After the Yahoo KRX enrichment, each refresh requests the KRX 정보데이터시스템 'ETF 전종목 시세' table (`dbms/MDC/STAT/standard/MDCSTAT04301`) once — a single POST covers every listed ETF for the most recent trading day, walking back one calendar day at a time (up to 7 attempts) across weekends and holidays. For Korean ETFs whose 6-digit code matches a parseable row:

- `nav` is filled only when still `null` (same fill-only-null rule as the Yahoo enrichment).
- `premiumDiscount` (괴리율, `% = (close − NAV) / NAV × 100`, 2 decimals) is set; the field exists snapshot-wide and is `null` for every non-Korean or unmatched ETF.
- `dataQuality.navAsOf` records the KRX trading day the values are as of, and a `KRX 정보데이터시스템` source entry lists the fields actually filled.

The step is strictly best-effort: a blocked endpoint, schema change, or exhausted walk-back logs one warning and leaves `nav`/`premiumDiscount` `null` without affecting the rest of the refresh. `KRX_NAV_DISABLE=1` skips the fetch entirely. Rows with unparseable close or NAV values are skipped, never estimated. `npm run check:data` enforces that `nav` is null-or-positive and `premiumDiscount` (when the field is present) is null or a finite percentage within ±50. Both fields first appear with the first CI refresh after this change; the analysis dashboard shows `-` until then.

## US Collection

The US universe uses Yahoo Finance `MOST_ACTIVES_ETFS`:

```text
https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=MOST_ACTIVES_ETFS
```

EIAYN requests the top high-volume records and supplements core ETFs that should remain searchable even when not in the current most-active page. Yahoo chart supplies the price history used for 3-year and 5-year calculations. StockAnalysis is used as an optional enrichment source for profile and holdings fields on the highest-volume US records and core supplements; the exact enrichment limit is recorded in the generated `coverage.us.stockAnalysisEnrichmentLimit`.

## Regional Collection

Hong Kong, Germany, France, Japan, Australia, and Vietnam representative ETFs are listed in `scripts/data/universe.mjs`. Vietnam representatives explicitly include `FUEVFVND.VN` VFMVN Diamond ETF. Each symbol is included only if Yahoo Finance chart returns a valid quote/history response.

Regional profile fields are enriched in this order (first non-null value wins):

1. Issuer or exchange profile overrides in `scripts/data/profile-overrides.mjs`, manually curated and applied with highest precedence so they always win over scraped values; currently `STW.AX` uses State Street and `1365.T` uses JPX.
2. StockAnalysis regional quote profile pages, such as `/quote/hkg/2800/`, `/quote/etr/EUNL/`, `/quote/tyo/1321/`, `/quote/asx/A200/`, and `/quote/hose/FUEVFVND/`.
3. Yahoo Finance quoteSummary, using a build-time public Yahoo session cookie/crumb, for profile fallback fields.

Regional holdings are still unavailable from these public profile sources and remain empty arrays unless a future source is added.

## 1-Year Performance Series (`performance1y`)

Each ETF carries an optional `performance1y` object — `{ start: 'YYYY-MM-DD', freq: 'weekly', values: [100, ...] }` — that the comparison overlay chart uses to draw normalized 1-year performance lines. `scripts/data/performance.mjs` derives it from the same price history as the other metrics: the K-ETF 1-year batch series for Korean ETFs, the Yahoo Finance 5-year chart series for US and regional ETFs, and the Yahoo KRX `.KS` chart as a fill-only-null fallback for Korean ETFs whose K-ETF history was too sparse. Sampling rule: take the trailing one year from the latest available point (inclusive boundary), keep the last available trading point of each ISO week (Monday-Sunday) ending at the most recent point, then normalize so `values[0]` is exactly `100` and later values are `(price / start price) × 100` rounded to 2 decimals. ETFs with fewer than 8 weekly points get `performance1y: null`. At roughly 53 numbers plus one date per ETF the field adds about 0.5 MB raw across ~1,348 ETFs; each run logs the serialized byte total. The field is optional in `npm run check:data` (shape is validated only when present and non-null), because the committed snapshot predates it: `performance1y` appears from the first data refresh after this change.

## History & Changes Artifacts

Besides `etfs.json`, every refresh run writes three derived files into `public/data/` (modules: `scripts/data/history.mjs`, `scripts/data/changes.mjs`, `scripts/data/feed.mjs`). They power the "점수 추이" (score history) and "오늘의 변화" (today's changes) features and are committed by the scheduled workflow together with the snapshot.

### `public/data/history.json` (schemaVersion 1)

Rolling AIYN score history: `{ schemaVersion: 1, updatedAt, entries: [{ date, generatedAt, scores }] }`.

- One entry per Asia/Seoul calendar date of `generatedAt`; re-running the pipeline on the same Seoul day replaces that day's entry.
- `scores` maps each ETF id to its integer `aiynScore`; ETFs with a `null` score are omitted.
- Entries are sorted ascending by date and pruned to the most recent 60.
- The file is seeded from the committed snapshot (one entry) so the UI can fetch it before the first scheduled refresh.

### `public/data/changes.json` (schemaVersion 1)

Diff of the new snapshot against the previously committed one: `{ schemaVersion: 1, generatedAt, previousGeneratedAt, newListings, delisted, feeChanges, scoreMoves }`.

- `newListings`/`delisted`: ETF id presence diff as `{ id, name, market }`, capped at 50 each, in snapshot display order.
- `feeChanges`: `{ id, name, from, to }` where both expense ratios are non-null and `|Δ| >= 0.0001` after a rounding-noise guard at 4 decimals.
- `scoreMoves`: `{ id, name, from, to }` where both scores exist and `|Δ aiynScore| >= 5`, sorted by `|Δ|` descending, capped at 20.
- On the first run (no previous snapshot) all arrays are empty and `previousGeneratedAt` is `null`. The file is intentionally not committed until the first CI refresh produces it (it needs two snapshots); the UI tolerates its absence.

### `public/data/feed.xml` (RSS 2.0)

Channel `ETF is All You Need — 데이터 업데이트` at `https://ducklove.github.io/eiayn/`. Each refresh run prepends one item titled with the change counts (e.g. `신규 상장 3종, 보수 변동 2종, 점수 급변 5종`) whose HTML-escaped description lists every changed ETF with a deep link (`https://ducklove.github.io/eiayn/?code=ID`). The latest 20 items are retained: previous items are recovered from the existing file and the feed is regenerated cleanly when it is missing or corrupt. Like `changes.json`, it first appears with the first CI refresh.

### Cadence and degradation

- All three files are written by every `npm run data:update` run: the scheduled workflow (`.github/workflows/fetch-data.yml`, cron `35 6 * * 1-5` UTC = 15:35 KST Mon–Fri, shortly after the Korean regular ETF session closes) and manual `workflow_dispatch` runs.
- The artifacts are strictly non-fatal: a missing or corrupt previous snapshot/history/feed logs a warning and degrades (diff against `null`, fresh history/feed) but never aborts the refresh, and a failed artifact never blocks writing `etfs.json`.
- `npm run check:data` validates `history.json` and `changes.json` only when the files exist (schema version, sorted unique dates, integer scores, array shapes and caps); a missing file is never an error.

## Benchmark Tracking Metrics

`risk.trackingError3y` and `risk.informationRatio3y` are computed when an ETF's `benchmarkIndex` maps to a known Yahoo index symbol (about 21 symbols covering ~155 ETFs; mapping table in `scripts/data/benchmark-tracking.mjs`). Benchmark chart series are fetched at most once per symbol per run and each fetch is optional: a failure leaves the affected ETFs' tracking fields `null`. ETFs with unmapped or missing benchmarks keep `null` — no estimation. Methodology details live in `docs/scoring.md`.

## Update Behavior

- Required source failures cause `npm run data:update` to fail.
- Optional StockAnalysis, Yahoo quoteSummary, KRX NAV, and holdings failures are logged and leave affected fields missing unless `check:data` marks the field as required.
- Korean ETF records with no usable numeric price are excluded and logged in `coverage.excluded`; `check:data` accepts `included + excluded = sourceTotal` for Korea while still requiring every included ETF to have a numeric price.
- Korean Yahoo KRX enrichment is optional per ETF: a failed or empty chart leaves that ETF exactly as K-ETF built it, never excludes it, and never aborts the run. The update log reports a single summary line with enriched/unavailable counts.
- `check:data` requires an expense ratio for all configured regional representative ETFs so GitHub Pages is not deployed with blank regional total-fee cells.
- The script does not silently fall back to fake data.
- Missing fields are stored as `null` and listed in `dataQuality.missingFields`.
- `npm run check:data` validates ETF counts, required fields, numeric price values, source attribution, and production-data wording before build.
- `sparkline` is generated from the latest 30 calendar days of available adjusted-price history. The number of plotted points can be below 30 because weekends, holidays, and non-trading days are not fabricated.

## Known Limitations

- Korean K-ETF batch history currently provides a 1-year series; 3-year and 5-year return/risk fields come from the best-effort Yahoo KRX enrichment and remain `null` for ETFs where Yahoo has no usable `.KS` history (delistings, very recent listings, symbols Yahoo does not cover) or where the enrichment fetch fails.
- `nav` and `premiumDiscount` come from the best-effort KRX enrichment and exist only for Korean ETFs the KRX table matches (first populated by the first CI refresh after 2026-06-11); non-Korean ETFs keep `null` because no equivalent batched public NAV source is wired yet. `risk.trackingError3y` and `risk.informationRatio3y` are computed only for the ~155 ETFs whose `benchmarkIndex` maps to a known Yahoo index symbol; the rest stay `null`.
- Yahoo Finance endpoints are public web endpoints, not guaranteed official APIs, and may be rate-limited or temporarily unavailable.
- StockAnalysis is an accessible public web source, not an official issuer API. Field names or table structure may change.
- Data is a build-time snapshot and may lag live market conditions.
