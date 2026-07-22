// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AiynRankingView } from './AiynRankingView.jsx';

function makeEtf(id, aiynScore, overrides = {}) {
  return {
    id,
    shortName: id,
    provider: '운용사',
    market: '국내',
    currency: 'KRW',
    aiynScore,
    scoreCoverage: 1,
    expenseRatio: 0.2,
    dividendYield: 1.5,
    aum: 1_000_000_000,
    returns: { y1: 7.5 },
    ...overrides,
  };
}

afterEach(cleanup);

describe('AiynRankingView', () => {
  it('renders rows ordered by AIYN score with 1-based ranks', () => {
    render(
      <AiynRankingView
        etfs={[makeEtf('Alpha', 60), makeEtf('Bravo', 95), makeEtf('Charlie', 80)]}
        onOpenEtf={() => {}}
      />,
    );

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Bravo')).toBeTruthy();
    expect(within(rows[0]).getByText('1')).toBeTruthy();
    expect(within(rows[1]).getByText('Charlie')).toBeTruthy();
    expect(within(rows[2]).getByText('Alpha')).toBeTruthy();
  });

  it('marks score, coverage, fee, dividend, return, and AUM columns for center alignment', () => {
    const { container } = render(
      <AiynRankingView etfs={[makeEtf('Alpha', 60), makeEtf('Bravo', 95)]} onOpenEtf={() => {}} />,
    );

    const headerLabels = ['AIYN', '충족도', '총보수', '배당 (연)', '1년', 'AUM'];
    for (const label of headerLabels) {
      expect(screen.getByRole('columnheader', { name: label }).classList).toContain(
        'ranking-center-cell',
      );
    }

    const firstBodyCells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    for (const index of [3, 4, 5, 6, 7, 8]) {
      expect(firstBodyCells[index].classList).toContain('ranking-center-cell');
    }
    expect(container.querySelector('.aiyn-ranking-table')).toBeTruthy();
  });

  it('excludes unscored ETFs and reports the scored share honestly', () => {
    render(
      <AiynRankingView
        etfs={[makeEtf('Alpha', 60), makeEtf('NoScore', null)]}
        onOpenEtf={() => {}}
      />,
    );

    expect(screen.queryByText('NoScore')).toBeNull();
    expect(screen.getByText(/점수 보유 1\/2종/)).toBeTruthy();
  });

  it('opens the analysis view when a row is clicked', () => {
    const onOpenEtf = vi.fn();
    render(<AiynRankingView etfs={[makeEtf('Alpha', 60)]} onOpenEtf={onOpenEtf} />);

    fireEvent.click(screen.getByText('Alpha'));
    expect(onOpenEtf).toHaveBeenCalledWith('Alpha');
  });

  it('links to the static rankings JSON API', () => {
    render(<AiynRankingView etfs={[makeEtf('Alpha', 60)]} onOpenEtf={() => {}} />);
    const link = screen.getByRole('link', { name: 'data/rankings.json' });
    expect(link.getAttribute('href')).toContain('data/rankings.json');
  });

  it('shows an empty state when nothing is scored', () => {
    render(<AiynRankingView etfs={[makeEtf('NoScore', null)]} onOpenEtf={() => {}} />);
    expect(screen.getByText('AIYN 점수가 계산된 ETF가 없습니다.')).toBeTruthy();
  });
});
