# Data Sources

EIAYN is designed for GitHub Pages static hosting. The browser does not call external finance APIs. Instead, `scripts/fetch-etf-data.mjs` fetches public data at build time and writes `public/data/etfs.json`.

## Source Summary

| Source | URL | Fields |
| --- | --- | --- |
| K-ETF | `https://www.k-etf.com/` and `https://anchor.k-etf.com/api/` | Korea active ETF lineup, price, 1-day return, volume, trading value, market cap, category, issuer when available, 3M/1Y returns, total fee, 1Y history, top holdings |
| Yahoo Finance MOST_ACTIVES_ETFS screener | `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved` | US high-volume ETF universe, US ETF price, volume, AUM, expense ratio where available |
| Yahoo Finance chart | `https://query1.finance.yahoo.com/v8/finance/chart/` | price, adjusted-close history, dividend events, quote timestamp, listed-symbol currency, USD/KRW |
| StockAnalysis | `https://stockanalysis.com/` | US ETF expense ratio, assets/AUM, dividend yield, inception date, top holdings where available |
| EIAYN regional representative universe | `https://github.com/ducklove/eiayn` | regional representative ETF selection and market classification |

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

## US Collection

The US universe uses Yahoo Finance `MOST_ACTIVES_ETFS`:

```text
https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=MOST_ACTIVES_ETFS
```

EIAYN requests the top high-volume records and supplements core ETFs that should remain searchable even when not in the current most-active page. Yahoo chart supplies the price history used for 3-year and 5-year calculations. StockAnalysis is used as an optional enrichment source for profile and holdings fields on the highest-volume US records and core supplements; the exact enrichment limit is recorded in the generated `coverage.us.stockAnalysisEnrichmentLimit`.

## Regional Collection

Hong Kong, Germany, France, Japan, Australia, and Vietnam representative ETFs are listed in `scripts/data/universe.mjs`. Vietnam representatives explicitly include `FUEVFVND.VN` VFMVN Diamond ETF. Each symbol is included only if Yahoo Finance chart returns a valid quote/history response. Regional holdings, AUM, and expense data are often unavailable from the public sources used here, so those fields are kept as `null` or empty arrays.

## Update Behavior

- Required source failures cause `npm run data:update` to fail.
- Optional StockAnalysis profile/holdings failures are logged and leave affected fields missing.
- The script does not silently fall back to fake data.
- Missing fields are stored as `null` and listed in `dataQuality.missingFields`.
- `npm run check:data` validates ETF counts, required fields, numeric price values, source attribution, and production-data wording before build.

## Known Limitations

- Korean K-ETF batch history currently provides a 1-year series; Korean 3-year and 5-year return/risk fields are therefore `null` unless a future source is added.
- `nav`, `risk.trackingError3y`, and `risk.informationRatio3y` are `null` until reliable benchmark-aligned series are mapped.
- Yahoo Finance endpoints are public web endpoints, not guaranteed official APIs, and may be rate-limited or temporarily unavailable.
- StockAnalysis is an accessible public web source, not an official issuer API. Field names or table structure may change.
- Data is a build-time snapshot and may lag live market conditions.
