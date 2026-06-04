# AIYN Scoring and Metrics

AIYN scores are deterministic and computed from the generated ETF snapshot. Scores are not hardcoded in the React UI.

## Return Metrics

Price history uses adjusted close when Yahoo Finance chart provides it, otherwise close.

- 3-month return: period return from the first trading point on or after the date 3 months before the latest point.
- 1-year return: period return from the first trading point on or after the date 1 year before the latest point.
- 3-year annualized return: `(ending / beginning)^(1 / 3) - 1`.
- 5-year annualized return: `(ending / beginning)^(1 / 5) - 1`.

If there is not enough history for a period, the metric is `null`.

## Risk Metrics

- Volatility: standard deviation of daily returns over the latest 3-year window, annualized with `sqrt(252)`.
- Max drawdown: worst peak-to-trough loss over the latest 3-year window.
- Sharpe ratio: annualized mean daily return divided by annualized volatility.
- Risk-free rate: `0%` for the current simplified calculation.

Tracking error and information ratio remain `null` until reliable benchmark mappings and adjusted benchmark series are available for every supported ETF.

## Score Components

The score is calculated from these components:

| Component | Weight | Direction |
| --- | ---: | --- |
| Cost efficiency | 18% | lower expense ratio is better |
| Scale/liquidity proxy | 12% | higher log AUM is better |
| Performance | 26% | higher 1Y/3Y/5Y returns are better |
| Risk-adjusted profile | 22% | higher Sharpe, lower volatility, lower drawdown are better |
| Tracking quality | 10% | lower tracking error and higher information ratio are better |
| Diversification | 12% | lower top-holding concentration is better |

Each component is normalized across the current ETF universe to a 0-100 range. Missing component values are excluded and the remaining component weights are redistributed for that ETF. Missing data is therefore not treated as a forced zero, and the available score coverage is stored as `scoreCoverage`.

## Display Factors

The radar chart maps the score components into five Korean labels:

- 수익성: performance
- 가치: cost and scale
- 안정성: risk-adjusted profile
- 분산: diversification
- 효율성: cost and tracking quality

When a field is unavailable, the UI displays `-` or `데이터 없음` and lists the missing field names in the ETF detail panel.
