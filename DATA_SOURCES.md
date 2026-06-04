# Data Sources

EIAYN is designed for GitHub Pages static hosting. The browser does not call external finance APIs. Instead, `scripts/fetch-etf-data.mjs` fetches public data at build time and writes `public/data/etfs.json`.

## Source Summary

| Source | URL | Fields |
| --- | --- | --- |
| Yahoo Finance chart | `https://query1.finance.yahoo.com/v8/finance/chart/` | price, change percent, adjusted close history, dividend events, USD/KRW |
| StockAnalysis | `https://stockanalysis.com/` | expense ratio, assets/AUM, dividend yield, inception date, top holdings |
| EIAYN universe metadata | `https://github.com/ducklove/eiayn` | provider, market, asset class, theme, category, benchmark label |

## ETF URL Pattern

US ETF profile:

```text
https://stockanalysis.com/etf/{ticker}/
https://stockanalysis.com/etf/{ticker}/holdings/
```

KRX ETF profile:

```text
https://stockanalysis.com/quote/krx/{code}/
https://stockanalysis.com/quote/krx/{code}/holdings/
```

Yahoo chart:

```text
https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=5y&interval=1d&events=div%7Csplit&includeAdjustedClose=true
```

Korean ETF Yahoo symbols use the `.KS` suffix, such as `360750.KS`.

## Update Behavior

- `npm run data:update` retries each network request up to three times.
- Required source failures cause the command to fail. The script does not silently fall back to fake data.
- Missing fields are stored as `null` and listed in `dataQuality.missingFields`.
- `npm run check:data` validates the generated production JSON before build.

## Known Limitations

- `nav`, `risk.trackingError3y`, and `risk.informationRatio3y` are currently `null` because reliable benchmark-aligned series are not yet mapped for every ETF.
- StockAnalysis is an accessible public web source, not an official issuer API. Field names or table structure may change.
- Yahoo Finance chart is an unofficial public endpoint and can be rate-limited or temporarily unavailable.
- Holdings are limited to the top rows parsed from StockAnalysis.
- Data is a build-time snapshot and may lag live market conditions.
