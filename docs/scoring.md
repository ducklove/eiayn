# AIYN Scoring and Metrics

AIYN scores are deterministic and computed from the generated ETF snapshot. Scores are not hardcoded in the React UI.

## Return Metrics

가격 이력은 Yahoo Finance의 조정종가가 있으면 사용하고, 없으면 종가를 사용합니다. 현재 국내 ETF의 3개월·1년 수익률은 네이버 금융 ETF 분석 자료를 우선 사용하며, 3개월 값은 ETF 전체 목록의 수익률도 보조 출처로 사용합니다. 비어 있는 수익률과 3년·5년 연환산 수익률은 Yahoo Finance의 KRX 종목 (`${code}.KS`) 이력으로 보완합니다. 네이버 금융에서 확보한 값은 유지하며, 장기 가격 이력이 부족하면 해당 값은 `null`입니다. 과거 K-ETF 수집 방식은 현재 갱신 경로에 사용되지 않습니다.

- 30-day return: period return from the first to the latest point in the generated recent-30-calendar-day sparkline.
- 3-month return: period return from the first trading point on or after the date 3 months before the latest point.
- 1-year return: period return from the first trading point on or after the date 1 year before the latest point.
- 3-year annualized return: `(ending / beginning)^(1 / 3) - 1`.
- 5-year annualized return: `(ending / beginning)^(1 / 5) - 1`.

If there is not enough reliable history for a period, the metric is `null`.

## Risk Metrics

- Volatility: standard deviation of daily returns over the latest 3-year window, annualized with `sqrt(252)`.
- Max drawdown: worst peak-to-trough loss over the latest 3-year window.
- Sharpe ratio: annualized mean daily return divided by annualized volatility.
- Risk-free rate: `0%` for the current simplified calculation.

Tracking error and information ratio are computed against mapped benchmark index series — see the [Tracking Metrics](#tracking-metrics) section below; ETFs whose `benchmarkIndex` has no mapped Yahoo symbol keep `null` rather than an estimate. Korean ETFs get 3-year risk metrics from the Yahoo KRX (`.KS`) chart enrichment where Yahoo history exists, computed with the same formulas as US and regional ETFs. The enrichment is best-effort: when Yahoo has no usable history for a symbol or the fetch fails, those fields stay `null` and the ETF is otherwise unchanged.

## Score Components

The score is calculated from these components:

| Component | Weight | Direction |
| --- | ---: | --- |
| Cost efficiency | 18% | lower expense ratio is better |
| Scale/liquidity proxy | 12% | higher log AUM is better |
| Short-term return | 8% | higher 30D and 3M returns are better |
| Long-term return | 18% | higher 1Y/3Y/5Y returns are better |
| Risk-adjusted profile | 22% | higher Sharpe, lower volatility, lower drawdown are better |
| Tracking quality | 10% | lower tracking error and higher information ratio are better |
| Diversification | 12% | lower top-holding concentration is better |

Most components are normalized across the current ETF universe to a 0-100 range. Return metrics use percentile-rank normalization so one or two extreme leveraged products do not compress otherwise strong performers near the bottom of the scale. Missing component values are excluded and the remaining component weights are redistributed for that ETF. Missing data is therefore not treated as a forced zero, and the available score coverage is stored as `scoreCoverage`.

The short-term return component weights available return windows as:

- 30-day return: 50%
- 3-month return: 50%

The long-term return component weights available return windows as:

- 1-year return: 45%
- 3-year annualized return: 30%
- 5-year annualized return: 25%

## Display Factors

The radar chart maps the score components into Korean labels:

- `단기 수익`: 30-day and 3-month return profile
- `장기 수익`: 1-year, 3-year, and 5-year return profile
- `가치`: cost and scale
- `안정성`: risk-adjusted profile
- `분산`: diversification
- `효율성`: cost and tracking quality

Cost efficiency is still part of the total score, but it is not shown as a separate radar factor because annual expense ratio is already displayed as a primary ETF metric and is also reflected in `가치` and `효율성`.

When a field is unavailable, the UI displays `-` or `데이터 없음` rather than estimating it.

## Tracking Metrics

`risk.trackingError3y` and `risk.informationRatio3y` compare an ETF's daily adjusted-close returns with its benchmark index over the trailing 3-year window. The benchmark series comes from the Yahoo Finance chart API: `scripts/data/benchmark-tracking.mjs` maps the `benchmarkIndex` strings that occur in the universe (K-ETF vendor codes such as `KRX-EI-KSP200` and display names such as `S&P 500`) to Yahoo index symbols via `resolveBenchmarkSymbol`.

- The ETF and benchmark series are inner-joined by trading date. Fewer than 120 overlapping points (roughly six months of shared trading days) yields `null` for both metrics.
- Daily active return = ETF simple daily return − benchmark simple daily return.
- Tracking error (3y) = sample standard deviation of daily active returns × `sqrt(252)` × 100, in percent, rounded to 2 decimals.
- Information ratio (3y) = (mean daily active return × 252 × 100) ÷ tracking error, rounded to 2 decimals. It is `null` when the tracking error is zero (or rounds to zero) or is not finite.

벤치마크가 가격지수이고 ETF 이력이 분배금을 반영한 조정가격이면 분배금 처리 차이가 정보비율에 영향을 줄 수 있습니다. 추적오차와 정보비율은 `benchmarkIndex`를 공개된 Yahoo 지수로 연결하고 필요한 관측치를 확보한 경우에만 계산합니다. 연결되지 않은 테마·선물·레버리지·인버스·통화·채권 지수는 추정하지 않고 `null`로 유지합니다. 데이터 충족 수치는 갱신마다 달라지므로 최신 스냅샷의 해당 필드를 기준으로 확인합니다.
