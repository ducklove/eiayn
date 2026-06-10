// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PortfolioSimulator } from './PortfolioSimulator.jsx';

function makeEtf(overrides = {}) {
  return {
    id: '069500',
    shortName: 'KODEX 200',
    name: 'KODEX 200',
    expenseRatio: 0.15,
    dividendYield: 1.8,
    aiynScore: 82,
    theme: '국내 대표지수',
    market: 'KR',
    ...overrides,
  };
}

const alpha = makeEtf({
  id: 'AAA',
  shortName: 'Alpha',
  expenseRatio: 0.2,
  dividendYield: 2,
  aiynScore: 90,
  theme: '국내 대표지수',
  market: 'KR',
});
const bravo = makeEtf({
  id: 'BBB',
  shortName: 'Bravo',
  expenseRatio: 0.6,
  dividendYield: null,
  aiynScore: 70,
  theme: '미국 대표지수',
  market: 'US',
});
const charlie = makeEtf({ id: 'CCC', shortName: 'Charlie', expenseRatio: 0.4 });
const delta = makeEtf({ id: 'DDD', shortName: 'Delta', expenseRatio: 0.8 });

function metricEntry(label) {
  return screen.getByText(label).parentElement.querySelector('dd');
}

afterEach(cleanup);

describe('PortfolioSimulator', () => {
  it('shows a hint instead of inputs with fewer than 2 ETFs', () => {
    render(<PortfolioSimulator selectedEtfs={[alpha]} />);
    expect(
      screen.getByText('ETF를 2개 이상 비교 바구니에 담으면 조합을 시뮬레이션할 수 있습니다.'),
    ).toBeTruthy();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('button', { name: '균등 배분' })).toBeNull();
  });

  it('defaults to equal weights and shows the weighted summary', () => {
    render(<PortfolioSimulator selectedEtfs={[alpha, bravo]} />);
    expect(screen.getByLabelText('Alpha 비중').value).toBe('50');
    expect(screen.getByLabelText('Bravo 비중').value).toBe('50');
    expect(screen.getByText('100.0%')).toBeTruthy();
    expect(screen.queryByText(/자동 정규화한 비중/)).toBeNull();

    expect(metricEntry('합성 총보수').textContent).toContain('0.40%');
    expect(metricEntry('가중 AIYN 점수').textContent).toContain('80.0점');
  });

  it('notes per-metric coverage when an ETF lacks the field', () => {
    render(<PortfolioSimulator selectedEtfs={[alpha, bravo]} />);
    const dividend = metricEntry('합성 배당률');
    // Bravo has no dividend yield, so Alpha carries 100% of the metric.
    expect(dividend.textContent).toContain('2.00%');
    expect(dividend.textContent).toContain('1/2종 반영');
  });

  it('shows 데이터 없음 when no ETF has the field', () => {
    render(
      <PortfolioSimulator
        selectedEtfs={[
          makeEtf({ id: 'AAA', shortName: 'Alpha', aiynScore: null }),
          makeEtf({ id: 'BBB', shortName: 'Bravo', aiynScore: null }),
        ]}
      />,
    );
    expect(metricEntry('가중 AIYN 점수').textContent).toContain('데이터 없음');
  });

  it('updates the summary and shows the normalization note when a weight is edited', () => {
    render(<PortfolioSimulator selectedEtfs={[alpha, bravo]} />);
    fireEvent.change(screen.getByLabelText('Alpha 비중'), { target: { value: '100' } });

    expect(screen.getByText('150.0%')).toBeTruthy();
    expect(screen.getByText(/자동 정규화한 비중/)).toBeTruthy();
    // Normalized 100/150 and 50/150: 0.2 × 2/3 + 0.6 × 1/3 = 0.33%.
    expect(metricEntry('합성 총보수').textContent).toContain('0.33%');
  });

  it('resets to equal weights with 균등 배분', () => {
    render(<PortfolioSimulator selectedEtfs={[alpha, bravo]} />);
    fireEvent.change(screen.getByLabelText('Alpha 비중'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: '균등 배분' }));

    expect(screen.getByLabelText('Alpha 비중').value).toBe('50');
    expect(screen.getByLabelText('Bravo 비중').value).toBe('50');
    expect(screen.queryByText(/자동 정규화한 비중/)).toBeNull();
    expect(metricEntry('합성 총보수').textContent).toContain('0.40%');
  });

  it('rebalances untouched weights when the basket changes', () => {
    const { rerender } = render(<PortfolioSimulator selectedEtfs={[alpha, bravo]} />);
    rerender(<PortfolioSimulator selectedEtfs={[alpha, bravo, charlie, delta]} />);

    for (const name of ['Alpha', 'Bravo', 'Charlie', 'Delta']) {
      expect(screen.getByLabelText(`${name} 비중`).value).toBe('25');
    }
  });

  it('keeps edited weights and gives new ETFs the equal-split default', () => {
    const { rerender } = render(<PortfolioSimulator selectedEtfs={[alpha, bravo]} />);
    fireEvent.change(screen.getByLabelText('Alpha 비중'), { target: { value: '80' } });
    rerender(<PortfolioSimulator selectedEtfs={[alpha, bravo, charlie]} />);

    expect(screen.getByLabelText('Alpha 비중').value).toBe('80');
    expect(screen.getByLabelText('Bravo 비중').value).toBe('50');
    expect(screen.getByLabelText('Charlie 비중').value).toBe('33.3');
  });

  it('shows the theme and market composition with the assumptions caveat', () => {
    render(<PortfolioSimulator selectedEtfs={[alpha, bravo]} />);
    expect(screen.getByText('테마 구성')).toBeTruthy();
    expect(screen.getByText('시장 구성')).toBeTruthy();
    expect(screen.getByText('국내 대표지수')).toBeTruthy();
    expect(screen.getByText('미국 대표지수')).toBeTruthy();
    expect(screen.getByText('KR')).toBeTruthy();
    expect(screen.getByText('US')).toBeTruthy();
    expect(screen.getAllByText('50.0%')).toHaveLength(4);
    expect(screen.getByText(/상관관계\/리밸런싱 미반영/)).toBeTruthy();
  });

  it('asks for a positive weight when every weight is zero', () => {
    render(<PortfolioSimulator selectedEtfs={[alpha, bravo]} />);
    fireEvent.change(screen.getByLabelText('Alpha 비중'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Bravo 비중'), { target: { value: '0' } });

    expect(
      screen.getByText('비중을 1개 이상 0보다 크게 입력하면 합성 지표를 계산합니다.'),
    ).toBeTruthy();
    expect(screen.queryByText('합성 총보수')).toBeNull();
  });
});
