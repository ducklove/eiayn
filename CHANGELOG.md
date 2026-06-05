# Changelog

## 2026-06-05

- Split the AIYN profitability display into short-term return and long-term return factors.
- Added recent 30-day sparkline return to the short-term return score alongside 3-month return.
- Updated scoring documentation, factor help text, and unit tests for the new return-factor split.

## 2026-06-04

- Expanded the production ETF snapshot from a 10-ETF focused universe to all active Korean ETFs, Yahoo Finance high-volume US ETFs, and representative Hong Kong/Germany/France/Japan/Australia/Vietnam ETFs.
- Added source adapters for K-ETF, Yahoo Finance, StockAnalysis, and regional universe configuration.
- Updated data validation to enforce market coverage, source attribution, numeric prices, and full Korean ETF coverage.
- Replaced production UI hardcoded ETF data with a build-time JSON snapshot.
- Added public data pipeline for Yahoo Finance chart and StockAnalysis.
- Added data validation, deterministic AIYN scoring, return/risk calculations, and unit tests.
- Added loading/error/empty states, localStorage favorites, recent views, CSV export, shareable URLs, and guide modal.
- Updated GitHub Pages workflow to run verify and build on push, manual dispatch, and weekday schedule.
