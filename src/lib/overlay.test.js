import { describe, expect, it } from 'vitest';
import { buildOverlaySeries } from './overlay.js';

const etf = (id, dates, values) => ({ id, shortName: id, performance1y: { dates, values } });
describe('실제 관측일 성과 비교', () => {
  it('길이가 같아도 서로 다른 날짜를 같은 시점으로 비교하지 않는다', () => {
    const result = buildOverlaySeries([
      etf('A', ['2026-01-02', '2026-01-09', '2026-01-16'], [100, 110, 121]),
      etf('B', ['2026-01-09', '2026-01-16', '2026-01-23'], [100, 120, 150]),
    ]);
    expect(result.dates).toEqual(['2026-01-09', '2026-01-16']);
    expect(result.series[0].values[0]).toBe(100);
    expect(result.series[0].changePercent).toBeCloseTo(10);
    expect(result.series[1].changePercent).toBeCloseTo(20);
  });
  it('휴장 때문에 관측일이 다른 주는 보간하지 않고 제외한다', () => {
    const result = buildOverlaySeries([
      etf('A', ['2026-01-02', '2026-01-09', '2026-01-16'], [100, 110, 120]),
      etf('B', ['2026-01-02', '2026-01-08', '2026-01-16'], [100, 500, 80]),
    ]);
    expect(result.window).toBe(2);
    expect(result.max).toBeCloseTo(120);
    expect(result.min).toBeCloseTo(80);
  });
  it('날짜가 없는 과거 자료는 제외 목록에 표시한다', () => {
    const result = buildOverlaySeries([
      etf('A', ['2026-01-02', '2026-01-09'], [100, 110]),
      etf('B', ['2026-01-02', '2026-01-09'], [100, 90]),
      { id: 'OLD', performance1y: { start: '2026-01-02', values: [100, 120] } },
    ]);
    expect(result.excluded).toEqual(['OLD']);
  });
  it('공통 날짜가 2개 미만이면 비교 차트를 만들지 않는다', () => {
    expect(
      buildOverlaySeries([
        etf('A', ['2026-01-02', '2026-01-09'], [100, 110]),
        etf('B', ['2026-01-09', '2026-01-16'], [100, 90]),
      ]),
    ).toBeNull();
    expect(buildOverlaySeries([])).toBeNull();
  });
  it.each([
    { dates: ['2026-01-02'], values: [100, 110] },
    { dates: ['2026-01-02', '2026-01-02'], values: [100, 110] },
    { dates: ['2026-01-09', '2026-01-02'], values: [100, 110] },
    { dates: ['2026-02-30', '2026-03-09'], values: [100, 110] },
    { dates: ['2026-01-02', '2026-01-09'], values: [0, 110] },
    { dates: ['2026-01-02', '2026-01-09'], values: [100, NaN] },
  ])('잘못된 관측 자료를 거부한다: %j', (performance1y) => {
    expect(
      buildOverlaySeries([
        { id: 'A', performance1y },
        etf('B', ['2026-01-02', '2026-01-09'], [100, 110]),
      ]),
    ).toBeNull();
  });
});
