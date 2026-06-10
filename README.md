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
npm run lint
npm run format
npm run test
npm run build
npm run verify
```

- `npm run build` is hermetic: it validates the committed snapshot (`public/data/etfs.json`) and builds the app. It does not fetch external data.
- `npm run data:update` refreshes the data snapshot from external sources; `npm run check:data` validates it.
- `npm run lint` runs ESLint; `npm run format` / `npm run format:check` apply or check Prettier formatting.
- `npm run verify` remains the full chain: refreshes data, validates data, runs unit tests, and builds the static site.

## Data Snapshot

The generated snapshot is written to:

```text
public/data/etfs.json
```

The deployed GitHub Pages app reads it with `import.meta.env.BASE_URL`, so the `/eiayn/` base path remains valid.

See [DATA_SOURCES.md](./DATA_SOURCES.md) and [docs/scoring.md](./docs/scoring.md).

## Deployment

Deployment and data refresh are split into separate workflows:

```text
.github/workflows/deploy-pages.yml   # build and deploy GitHub Pages
.github/workflows/fetch-data.yml     # scheduled ETF data refresh
.github/workflows/ci.yml             # lint, test, build on PRs and non-main branches
```

- `deploy-pages.yml` runs on push to `main` and manual `workflow_dispatch`. It tests and builds hermetically from the committed snapshot, so deploys no longer depend on external API availability.
- `fetch-data.yml` runs the weekday refresh at 21:30 UTC / 06:30 KST (and manual dispatch). It fetches fresh data, validates it, and runs tests; only then does it commit the updated `public/data/etfs.json` to `main` — accumulating snapshot history in git — and trigger the Pages deployment. If fetching or validation fails, nothing is committed and the previously deployed snapshot keeps serving.

## Investment Notice

EIAYN is an information tool based on public data snapshots. It is not investment advice. Prices, holdings, FX rates, and derived metrics can differ from current market data depending on source availability and update timing. Final investment responsibility belongs to the investor.
