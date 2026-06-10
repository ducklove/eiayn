# AIYN Scoring and Metrics

AIYN scores are deterministic and computed from the generated ETF snapshot. Scores are not hardcoded in the React UI.

## Return Metrics

Price history uses adjusted close when Yahoo Finance chart provides it, otherwise close. Korean ETF 3-month and 1-year returns use K-ETF return rankings when available, with K-ETF 1-year history as fallback. Korean 3-year and 5-year annualized returns come from a best-effort Yahoo Finance chart enrichment of the KRX symbol (`${code}.KS`); K-ETF values always keep priority and the Yahoo values fill only fields K-ETF left `null`.

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

Tracking error and information ratio remain `null` until reliable benchmark mappings and adjusted benchmark series are available for every supported ETF. Korean ETFs get 3-year risk metrics from the Yahoo KRX (`.KS`) chart enrichment where Yahoo history exists, computed with the same formulas as US and regional ETFs. The enrichment is best-effort: when Yahoo has no usable history for a symbol or the fetch fails, those fields stay `null` and the ETF is otherwise unchanged.

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
