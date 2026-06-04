# ETF is All You Need (EIAYN)

EIAYN is a static GitHub Pages React app for comparing a focused ETF universe with build-time public data snapshots.

Live page: https://ducklove.github.io/eiayn/

## What It Does

- Loads `/data/etfs.json`, generated during build, instead of bundling production ETF data in React source.
- Compares 10 supported ETFs across price, returns, expense ratio, AUM, dividend yield, holdings, and risk metrics.
- Supports integrated search across ETF metadata and top holdings.
- Supports market/theme/provider/risk filters, comparison basket, ranking, detail panel, favorites, recent views, CSV export, and shareable URLs.
- Stores favorites and recent views in browser `localStorage`.

## Supported Universe

Domestic ETFs:

- `360750` TIGER 미국S&P500
- `379800` KODEX 미국S&P500TR
- `458730` TIGER 미국배당다우존스
- `069500` KODEX 200
- `091160` KODEX 반도체

US ETFs:

- `QQQ`
- `VTI`
- `SOXX`
- `SCHD`
- `ARKK`

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
