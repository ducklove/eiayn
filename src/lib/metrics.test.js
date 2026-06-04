import { describe, expect, it } from 'vitest';
import {
  calculateAnnualizedReturn,
  calculateAnnualizedVolatility,
  calculateMaxDrawdown,
  calculatePeriodReturn,
  calculateSharpeRatio,
  parseCompactMoney,
} from './metrics.js';

describe('metrics', () => {
  const yearlySeries = [
    { date: '2020-01-01', value: 100 },
    { date: '2021-01-01', value: 110 },
    { date: '2022-01-01', value: 121 },
    { date: '2023-01-01', value: 133.1 },
    { date: '2024-01-01', value: 146.41 },
    { date: '2025-01-01', value: 161.051 },
  ];

  it('calculates period returns', () => {
    expect(calculatePeriodReturn(yearlySeries, { years: 1 })).toBeCloseTo(10, 4);
  });

  it('calculates annualized returns', () => {
    expect(calculateAnnualizedReturn(yearlySeries, 3)).toBeCloseTo(10, 4);
  });

  it('calculates annualized volatility from daily returns', () => {
    const volatileSeries = [
      { date: '2025-01-01', value: 100 },
      { date: '2025-01-02', value: 110 },
      { date: '2025-01-03', value: 99 },
      { date: '2025-01-04', value: 108.9 },
    ];
    expect(calculateAnnualizedVolatility(volatileSeries)).toBeGreaterThan(150);
  });

  it('calculates maximum drawdown', () => {
    const series = [
      { date: '2025-01-01', value: 100 },
      { date: '2025-01-02', value: 120 },
      { date: '2025-01-03', value: 90 },
      { date: '2025-01-04', value: 130 },
    ];
    expect(calculateMaxDrawdown(series)).toBeCloseTo(-25, 4);
  });

  it('calculates a positive sharpe ratio when mean return is positive', () => {
    expect(calculateSharpeRatio(yearlySeries)).toBeGreaterThan(0);
  });

  it('parses compact money strings', () => {
    expect(parseCompactMoney('$12.5B', 'USD')).toEqual({ value: 12_500_000_000, currency: 'USD' });
    expect(parseCompactMoney('18.77T', 'KRW')).toEqual({ value: 18_770_000_000_000, currency: 'KRW' });
  });
});
