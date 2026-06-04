# ETF is All You Need (EIAYN)

EIAYN is a static GitHub Pages React app for comparing ETFs with build-time public data snapshots.

Live page: https://ducklove.github.io/eiayn/

## What It Does

- Loads `/data/etfs.json`, generated during build, instead of bundling production ETF data in React source.
- Covers all active Korean ETFs from K-ETF, high-volume US ETFs from Yahoo Finance, and representative ETFs from Hong Kong, Germany, France, Japan, Australia, and Vietnam.
- Supports integrated search across ETF metadata and top holdings where holdings are available.
- Supports market/theme/provider/risk filters, comparison basket, ranking, detail panel, favorites, recent views, CSV export, and shareable URLs.
- Stores favorites and recent views in browser `localStorage`.
- Shows data update time, data sources, missing-field notes, and investment risk notice.

## Current Universe

The generated snapshot currently targets:

- Korea: all active ETFs published by K-ETF.
- US: Yahoo Finance `MOST_ACTIVES_ETFS` top list plus core ETF supplements such as `SPY`, `QQQ`, `VTI`, `SCHD`, `SOXX`, and `ARKK`.
- Regional representatives: Hong Kong, Germany, France, Japan, Australia, and Vietnam ETFs with Yahoo Finance chart coverage. Vietnam coverage explicitly includes `FUEVFVND.VN` VFMVN Diamond ETF.

Exact counts are recorded in `public/data/etfs.json` under `coverage`.

## Commands

```bash
npm ci
npm run data:update
npm run check:data
npm run test
npm run build
npm run verify
```

`npm run build` refreshes the data snapshot, validates it, then builds the app. `npm run verify` refreshes data, validates data, runs unit tests, and builds the static site.

## Data Snapshot

The generated snapshot is written to:

```text
public/data/etfs.json
```

The deployed GitHub Pages app reads it with `import.meta.env.BASE_URL`, so the `/eiayn/` base path remains valid.

See [DATA_SOURCES.md](./DATA_SOURCES.md) and [docs/scoring.md](./docs/scoring.md).

## Deployment

GitHub Pages deployment is defined in:

```text
.github/workflows/deploy-pages.yml
```

The workflow runs on:

- push to `main`
- manual `workflow_dispatch`
- scheduled weekday refresh at 21:30 UTC / 06:30 KST

## Investment Notice

EIAYN is an information tool based on public data snapshots. It is not investment advice. Prices, holdings, FX rates, and derived metrics can differ from current market data depending on source availability and update timing. Final investment responsibility belongs to the investor.
