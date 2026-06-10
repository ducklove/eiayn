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
- `instrument/holdings` for top holdings.

The current snapshot includes all active K-ETF records returned by the source. If K-ETF exposes a field for only part of the universe, the missing field remains `null` or an empty array and is listed in `dataQuality.missingFields`.

### Yahoo KRX long-horizon enrichment

K-ETF batch history covers only one year, so after the K-ETF build each Korean ETF is optionally enriched from the Yahoo Finance chart for its KRX symbol (`${code}.KS`, 5-year range). K-ETF values always keep priority: the enrichment fills only fields that are still `null` after the K-ETF build.

- `returns.y3Annualized` and `returns.y5Annualized` computed from the Yahoo adjusted-close series.
- `risk.volatility3yAnnualized`, `risk.maxDrawdown3y`, and `risk.sharpe3y` computed over the latest 3-year window, using the same formulas as US/regional ETFs.
- `returns.m3`, `returns.y1`, `dividendYield`, and `sparkline` only as fallbacks when K-ETF left them empty.

When an ETF is enriched, `yahooSymbol` is set to the `.KS` symbol and a `Yahoo Finance chart (KRX)` source entry is appended listing exactly the fields that were filled (stored in the written snapshot as a `dataQuality.sourceRefs` index into `sourceCatalog`). The `KOREA_YAHOO_LIMIT` environment variable restricts enrichment to the top-N Korean ETFs by trading value for partial CI or local runs; by default all Korean ETFs are attempted.

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

## Update Behavior

- Required source failures cause `npm run data:update` to fail.
- Optional StockAnalysis, Yahoo quoteSummary, and holdings failures are logged and leave affected fields missing unless `check:data` marks the field as required.
- Korean Yahoo KRX enrichment is optional per ETF: a failed or empty chart leaves that ETF exactly as K-ETF built it, never excludes it, and never aborts the run. The update log reports a single summary line with enriched/unavailable counts.
- `check:data` requires an expense ratio for all configured regional representative ETFs so GitHub Pages is not deployed with blank regional total-fee cells.
- The script does not silently fall back to fake data.
- Missing fields are stored as `null` and listed in `dataQuality.missingFields`.
- `npm run check:data` validates ETF counts, required fields, numeric price values, source attribution, and production-data wording before build.
- `sparkline` is generated from the latest 30 calendar days of available adjusted-price history. The number of plotted points can be below 30 because weekends, holidays, and non-trading days are not fabricated.

## Known Limitations

- Korean K-ETF batch history currently provides a 1-year series; 3-year and 5-year return/risk fields come from the best-effort Yahoo KRX enrichment and remain `null` for ETFs where Yahoo has no usable `.KS` history (delistings, very recent listings, symbols Yahoo does not cover) or where the enrichment fetch fails.
- `nav`, `risk.trackingError3y`, and `risk.informationRatio3y` are `null` until reliable ETF-level NAV and benchmark-aligned series are mapped.
- Yahoo Finance endpoints are public web endpoints, not guaranteed official APIs, and may be rate-limited or temporarily unavailable.
- StockAnalysis is an accessible public web source, not an official issuer API. Field names or table structure may change.
- Data is a build-time snapshot and may lag live market conditions.
