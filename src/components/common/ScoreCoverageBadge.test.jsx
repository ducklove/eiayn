// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScoreCoverageBadge } from './ScoreCoverageBadge.jsx';

function makeEtf(overrides = {}) {
  return {
    id: '069500',
    shortName: 'KODEX 200',
    name: 'KODEX 200',
    provider: '삼성자산운용',
    market: 'KR',
    currency: 'KRW',
    price: 36000,
    changePercent: 0.5,
    expenseRatio: 0.15,
    dividendYield: 1.8,
    aum: 5_000_000_000_000,
    aiynScore: 82,
    scoreCoverage: 1,
    scoreBreakdown: {
      '단기 수익': 70,
      '장기 수익': 75,
      가치: 60,
      안정성: 80,
      분산: 90,
      효율성: 85,
    },
    returns: { m3: 2.1, y1: 11.2, y3Annualized: 8.4, y5Annualized: 7.9 },
    risk: { volatility3yAnnualized: 14.2, maxDrawdown3y: -22.1, sharpe3y: 0.6 },
    holdings: [],
    sparkline: [1, 2, 3],
    ...overrides,
  };
}

afterEach(cleanup);

describe('ScoreCoverageBadge', () => {
  it('renders the rounded coverage percentage', () => {
    render(<ScoreCoverageBadge etf={makeEtf({ scoreCoverage: 0.876 })} />);
    expect(screen.getByText('데이터 충족도 88%')).toBeTruthy();
  });

  it('marks coverage below 80% with the partial class', () => {
    render(<ScoreCoverageBadge etf={makeEtf({ scoreCoverage: 0.75 })} />);
    const badge = screen.getByText('데이터 충족도 75%');
    expect(badge.classList.contains('partial')).toBe(true);
  });

  it('does not mark 80% or higher coverage as partial', () => {
    render(<ScoreCoverageBadge etf={makeEtf({ scoreCoverage: 0.8 })} />);
    const badge = screen.getByText('데이터 충족도 80%');
    expect(badge.classList.contains('partial')).toBe(false);
  });

  it('lists null-valued scoreBreakdown labels in the title', () => {
    const etf = makeEtf({
      scoreCoverage: 0.6,
      scoreBreakdown: {
        '단기 수익': 70,
        '장기 수익': null,
        가치: null,
        안정성: 80,
        분산: 90,
        효율성: 0,
      },
    });
    render(<ScoreCoverageBadge etf={etf} />);
    const badge = screen.getByText('데이터 충족도 60%');
    expect(badge.title).toContain('데이터가 없는 팩터: 장기 수익, 가치');
  });

  it('uses the all-factors title when nothing is missing', () => {
    render(<ScoreCoverageBadge etf={makeEtf()} />);
    const badge = screen.getByText('데이터 충족도 100%');
    expect(badge.title).toBe('모든 팩터가 실제 데이터로 계산되었습니다.');
  });

  it('handles a missing scoreBreakdown object', () => {
    render(<ScoreCoverageBadge etf={makeEtf({ scoreCoverage: 0.5, scoreBreakdown: undefined })} />);
    const badge = screen.getByText('데이터 충족도 50%');
    expect(badge.title).toBe('모든 팩터가 실제 데이터로 계산되었습니다.');
  });

  it.each([null, undefined, '0.9', Number.NaN])(
    'renders nothing for non-numeric coverage %s',
    (coverage) => {
      const { container } = render(
        <ScoreCoverageBadge etf={makeEtf({ scoreCoverage: coverage })} />,
      );
      expect(container.firstChild).toBeNull();
    },
  );
});
