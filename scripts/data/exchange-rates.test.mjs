import { describe, it, expect } from 'vitest';
import { buildExchangeRates } from './exchange-rates.mjs';
import { applyAumExchangeRates } from '../../src/lib/currency.js';
import { scoreComponents, buildScoringContext } from '../../src/lib/scoring.js';
import { rankEtfsByScore } from '../../src/lib/ranking.js';

const chart = (series) => ({
  url: 'https://query1.finance.yahoo.com/',
  series: series.map(([date, close]) => ({ date, close })),
});
describe('공통 기준일 규모 비교', () => {
  it('관측일이 다른 환율에서 공통 날짜를 선택한다', () => {
    const result = buildExchangeRates(
      {
        KRW: chart([
          ['2026-09-09', 1300],
          ['2026-09-10', 1400],
        ]),
        JPY: chart([['2026-09-09', 150]]),
      },
      '2026-09-11T00:00:00Z',
    );
    expect(result.asOf).toBe('2026-09-09');
    expect(result.ratesToUsd.KRW).toBe(1 / 1300);
    expect(result.ratesToUsd.USD).toBe(1);
  });
  it('공통 날짜가 없거나 7일보다 오래되면 갱신을 중단한다', () => {
    expect(() =>
      buildExchangeRates({ KRW: chart([['2026-09-01', 1300]]) }, '2026-09-11T00:00:00Z'),
    ).toThrow();
    expect(() =>
      buildExchangeRates(
        { KRW: chart([['2026-09-09', 1300]]), JPY: chart([['2026-09-10', 150]]) },
        '2026-09-11T00:00:00Z',
      ),
    ).toThrow();
  });
  it('원화 숫자가 더 커도 달러 환산 규모로 점수와 동점 순위를 정한다', () => {
    const etfs = applyAumExchangeRates(
      [
        { id: 'KR', currency: 'KRW', aum: 1300e9, aiynScore: 80, scoreCoverage: 1 },
        { id: 'US', currency: 'USD', aum: 2e9, aiynScore: 80, scoreCoverage: 1 },
      ],
      { asOf: '2026-09-10', ratesToUsd: { USD: 1, KRW: 1 / 1300 } },
    );
    expect(etfs[0].aumUsd).toBeCloseTo(1e9);
    const context = buildScoringContext(etfs);
    expect(scoreComponents(etfs[0], context).scale).toBe(0);
    expect(scoreComponents(etfs[1], context).scale).toBe(100);
    expect(rankEtfsByScore(etfs).map((etf) => etf.id)).toEqual(['US', 'KR']);
  });
  it('환율이 없는 외화 금액은 원금액으로 대체하지 않는다', () => {
    const etf = { id: 'A', currency: 'KRW', aum: 1e12 };
    expect(scoreComponents(etf, buildScoringContext([etf])).scale).toBeNull();
    expect(applyAumExchangeRates([etf], { ratesToUsd: { USD: 1 } })[0].aumUsd).toBeNull();
  });
});
