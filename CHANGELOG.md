# Changelog

## 2026-06-10 (round 3)

- Added screener presets: one-click chips (국내 시장대표, 고배당, 반도체, 커버드콜, 채권, 낮은 변동성) that apply validated filter combinations and switch to the sortable list view.
- Added a holding-cost calculator to the compare view: investment amount and holding period translate each compared ETF's expense ratio into annual and cumulative figures, with the no-returns/no-compounding assumption stated inline.
- Added a normalized performance overlay (start=100) to the compare view, backed by a new optional per-ETF `performance1y` weekly series (trailing 1 year, last point per ISO week) emitted by the pipeline for all markets with a Korea Yahoo-KRX fallback; the UI shows an honest placeholder until the first data refresh ships the field (~0.5MB compact across the snapshot).
- Added 78 Testing Library component/hook tests (EtfTable sorting/pagination/event isolation, theme and storage hooks, ErrorBoundary fallback, charts, modal) and 13 pipeline tests for the new series; unit suite now 183 tests plus 15 Playwright E2E scenarios.

## 2026-06-10 (round 2)

- Added dark mode: the topbar toggle persists the theme (system preference is the default), repeated literal colors were promoted to semantic tokens with a full dark palette, and an inline head script applies the saved theme before first paint.
- Added a sortable full-universe list view (`?view=list`): the filtered universe in a paginated table sortable by expense ratio, dividend, 1y/3y returns, AIYN score, and data coverage (nulls always last; mixed-currency price/AUM columns stay display-only). Rows open the analysis view with per-row favorite/compare actions, and CSV export in this mode exports the entire filtered result.
- Snapshot schema v2: per-ETF source attribution is normalized into a top-level `sourceCatalog` with integer `sourceRefs`, shrinking `public/data/etfs.json` from 6.99MB to 4.73MB (-32.4%). The pipeline emits v2 natively, `check:data` enforces it, and `scripts/migrate-snapshot.mjs` migrates v1 snapshots idempotently.
- Added a Playwright E2E smoke suite (12 tests: load, KST timestamp format, search-to-analysis, deep links, history back, `/` shortcut, guide modal Escape, CSV download, coverage badge, dark mode persistence, list view sorting/deep-linking) with a parallel CI job.

## 2026-06-10

- Fixed user-visible defects: timestamps rendering as `2026 06. 05.` (double-escaped regex), CSV exports missing the UTF-8 BOM (broken Korean text in Excel) and formula-injection guards, the full snapshot re-downloading on every visit (`cache: 'no-store'`), and share rewriting the URL even when the share dialog was dismissed.
- Fixed a latent pipeline crash: a failed ticker fetch raised `ReferenceError` (bare `excluded`) instead of recording the exclusion; surfaced by the new ESLint setup.
- Split the 1,272-line `App.jsx` into `components/{layout,compare,analysis,charts,common}` modules with shared `lib/{csv,links,holdings}` helpers, and added a top-level ErrorBoundary.
- Added browser back/forward navigation (pushState/popstate), a `/` search shortcut, Escape-to-close for the guide modal, and an AIYN score data-coverage badge that names the factors excluded for missing data.
- Added a precomputed search index plus deferred filtering so typing stays responsive across the 1,348-ETF universe; removed dead placeholder buttons; added favicon and Open Graph metadata.
- Pipeline: Korean ETFs are now best-effort enriched from Yahoo KRX (`.KS`) charts for 3y/5y returns, 3y risk metrics, and dividend-yield fallback (K-ETF values keep priority; failures leave ETFs unchanged); manual profile overrides now take highest merge precedence; StockAnalysis parsing extracted into pure, fixture-tested functions; duplicated utilities consolidated into `scripts/data/shared.mjs`; the forbidden-token data check now scans only self-authored fields.
- Tooling/CI: ESLint 9 + Prettier with a repo-wide formatting baseline and a CI workflow (lint, test, build) for branches and PRs; the scheduled data refresh moved to a dedicated workflow that commits the snapshot and then triggers deployment, making Pages builds hermetic (no external API calls during deploy).
- Unit tests grew from 23 to 68, covering CSV escaping, date formatting, the search index, Korea enrichment merge behavior, and the StockAnalysis/K-ETF parsers.

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
