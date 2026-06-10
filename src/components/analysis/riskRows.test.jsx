// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { RiskRow, riskMetricRows } from './riskRows.jsx';

function makeEtf(risk) {
  return {
    id: '069500',
    shortName: 'KODEX 200',
    name: 'KODEX 200',
    provider: '삼성자산운용',
    market: 'KR',
    currency: 'KRW',
    aiynScore: 82,
    returns: { m3: 2.1, y1: 11.2, y3Annualized: 8.4, y5Annualized: 7.9 },
    risk,
    holdings: [],
    sparkline: [],
  };
}

afterEach(cleanup);

describe('riskMetricRows', () => {
  it('builds formatted rows for every finite risk metric', () => {
    const rows = riskMetricRows(
      makeEtf({
        volatility3yAnnualized: 14.2,
        maxDrawdown3y: -22.1,
        sharpe3y: 0.6,
        trackingError3y: 0.8,
        informationRatio3y: 0.2,
      }),
    );
    expect(rows.map((row) => row.label)).toEqual([
      '변동성 (3년 연환산)',
      '최대낙폭 (3년)',
      '샤프지수 (3년)',
      '추적오차 (3년)',
      '정보비율 (3년)',
    ]);
    expect(rows.map((row) => row.value)).toEqual(['14.20%', '-22.10%', '0.60', '0.80%', '0.20']);
  });

  it('filters out null, missing, and non-finite metrics', () => {
    const rows = riskMetricRows(
      makeEtf({
        volatility3yAnnualized: 12.34,
        maxDrawdown3y: null,
        sharpe3y: undefined,
        trackingError3y: Number.NaN,
        informationRatio3y: -0.25,
      }),
    );
    expect(rows.map((row) => row.label)).toEqual(['변동성 (3년 연환산)', '정보비율 (3년)']);
    expect(rows.map((row) => row.value)).toEqual(['12.34%', '-0.25']);
  });

  it('keeps zero-valued metrics', () => {
    const rows = riskMetricRows(makeEtf({ sharpe3y: 0 }));
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('샤프지수 (3년)');
    expect(rows[0].value).toBe('0.00');
  });

  it('returns no rows when risk data is absent', () => {
    expect(riskMetricRows(makeEtf(undefined))).toEqual([]);
    expect(riskMetricRows(makeEtf({}))).toEqual([]);
  });
});

describe('RiskRow', () => {
  it('renders the label as dt and the value as dd', () => {
    const { container } = render(<RiskRow label="샤프지수 (3년)" value="0.60" />);
    expect(container.querySelector('dt').textContent).toBe('샤프지수 (3년)');
    expect(container.querySelector('dd').textContent.trim()).toBe('0.60');
    expect(container.querySelector('dd span')).toBeNull();
  });

  it('renders an optional tag inside the dd', () => {
    const { container } = render(<RiskRow label="변동성 (3년 연환산)" value="14.20%" tag="높음" />);
    expect(container.querySelector('dd span').textContent).toBe('높음');
    expect(container.querySelector('dd').textContent).toContain('14.20%');
  });
});
