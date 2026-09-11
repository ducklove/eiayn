# ETF is All You Need (EIAYN)

EIAYN is a static GitHub Pages React app for comparing ETFs with build-time public data snapshots.

Live page: https://ducklove.github.io/eiayn/

## What It Does

- Loads `/data/etfs.json`, generated during build, instead of bundling production ETF data in React source.
- Covers all listed Korean ETFs from Naver Finance, high-volume US ETFs from Yahoo Finance, and representative ETFs from Hong Kong, Germany, France, Japan, Australia, and Vietnam.
- Supports integrated search across ETF metadata and top holdings where holdings are available.
- Supports market/theme/provider/risk filters, comparison basket, ranking, detail panel, favorites, recent views, CSV export, and shareable URLs.
- Stores favorites and recent views in browser `localStorage`.
- Shows data update time, data sources, missing-field notes, and investment risk notice.

## Current Universe

The generated snapshot currently targets:

- Korea: all listed ETFs from the Naver Finance ETF lineup (the former K-ETF and KRX 정보데이터시스템 sources shut their public endpoints in 2026-06/07).
- US: Yahoo Finance `MOST_ACTIVES_ETFS` top list plus core ETF supplements such as `SPY`, `QQQ`, `VTI`, `SCHD`, `SOXX`, and `ARKK`.
- Regional representatives: Hong Kong, Germany, France, Japan, Australia, and Vietnam ETFs with Yahoo Finance chart coverage. Vietnam coverage explicitly includes `FUEVFVND.VN` VFMVN Diamond ETF.

Exact counts are recorded in `public/data/etfs.json` under `coverage`.

## Commands

Node.js 24 이상을 사용합니다 (`.node-version`). 이전 Node.js에서는 현재 테스트 의존성을 불러오지 못할 수 있습니다.

```bash
npm ci
npm run data:update
npm run check:data
npm run lint
npm run format
npm run test
npm run test:e2e
npm run build
npm run verify
```

- `npm run build` is hermetic: it validates the committed snapshot (`public/data/etfs.json`) and builds the app. It does not fetch external data.
- `npm run data:update` refreshes the data snapshot from external sources; `npm run check:data` validates it.
- `npm run lint` runs ESLint; `npm run format` / `npm run format:check` apply or check Prettier formatting.
- `npm run test:e2e` runs the Playwright end-to-end suite (`e2e/`): it builds hermetically and tests the preview server at `http://127.0.0.1:4173/eiayn/`.
- One-time E2E setup: `npx playwright install chromium` downloads the browser binary.
- `npm run verify` remains the full chain: refreshes data, validates data, runs unit tests, and builds the static site.

## Data Snapshot

The generated snapshot is written to:

```text
public/data/etfs.json
```

The deployed GitHub Pages app reads it with `import.meta.env.BASE_URL`, so the `/eiayn/` base path remains valid.

### Public JSON API

The build also publishes a machine-readable AIYN ranking next to the snapshot:

```text
https://ducklove.github.io/eiayn/data/rankings.json
```

It lists the top 100 ETFs by AIYN score (descending; ETFs without a score are
excluded, ties break by score coverage, then AUM, then id) with identity
fields, score/coverage, headline metrics, and an analysis-view deep link per
entry. It is regenerated on every deploy by `scripts/build-rankings.mjs` from
the committed snapshot, sharing the exact ordering logic with the in-app
AIYN 랭킹 view (`?view=ranking`). Missing metrics are `null`, never estimated.

See [DATA_SOURCES.md](./DATA_SOURCES.md) and [docs/scoring.md](./docs/scoring.md).

## Deployment

Deployment and data refresh are split into separate workflows:

```text
.github/workflows/deploy-pages.yml   # build and deploy GitHub Pages
.github/workflows/fetch-data.yml     # scheduled ETF data refresh
.github/workflows/ci.yml             # lint, test, build on PRs and non-main branches
```

- `deploy-pages.yml`은 `main` 푸시 또는 수동 실행 시 커밋된 스냅샷으로 빌드합니다. 데이터 검사, 단위 테스트, ESLint, 브라우저 E2E를 통과한 결과만 배포합니다. 배포 중 외부 금융 API를 호출하지 않습니다.
- `fetch-data.yml`은 평일 06:35 UTC / 15:35 KST에 갱신을 예약합니다 (실제 실행은 GitHub 스케줄러 지연에 따라 늦어질 수 있습니다). 데이터 수집·검사·테스트를 통과하면 스냅샷을 `main`에 커밋하고 배포를 실행합니다. 수집이나 검증 실패 시 기존 배포 데이터를 유지합니다.

## 검색 사용법

- 이름 일부, 종목코드, 지수, 테마, 운용사, 공개된 보유종목으로 검색합니다. `KODEX200`, `나스닥 100`, `미국 배당`, `삼성 전자`처럼 띄어쓰기를 바꾸거나 단어를 조합할 수 있습니다.
- ETF명과 코드가 일치하는 결과를 우선 표시하며, 보유종목이 검색된 경우 그 이유를 표시합니다. 일부 한·영 표기(`코덱스/KODEX`, `엔비디아/NVIDIA` 등)를 지원합니다. 임의의 오타 교정이나 모든 이름의 자동 번역은 제공하지 않습니다.
- Enter 또는 검색 버튼은 전체 결과를 엽니다. ↑↓로 결과를 선택한 뒤 Enter를 누르거나 결과를 클릭하면 개별 분석으로 이동합니다. `/`로 검색창에 이동하고 Esc로 제안 목록을 닫습니다.
- 상단 검색은 전체 ETF를 대상으로 하며 전체 결과를 열 때 기존 필터를 초기화합니다. 목록에서는 시장·테마·운용사·리스크로 결과를 좁힐 수 있습니다.
- 검색어와 필터는 URL에 반영되어 공유, 새로고침, 뒤로가기에서도 복원됩니다. 이름 일부만으로 검색이 안 되면 보유종목 자료가 없는 ETF인지, 조회 대상이 현재 스냅샷에 포함되어 있는지 확인하세요.

전반적인 검토 결과와 후속 기능 제안은 [2026-09-11 검토 보고서](docs/project-review-2026-09-11.md)에 정리했습니다.

## Investment Notice

EIAYN is an information tool based on public data snapshots. It is not investment advice. Prices, holdings, FX rates, and derived metrics can differ from current market data depending on source availability and update timing. Final investment responsibility belongs to the investor.
