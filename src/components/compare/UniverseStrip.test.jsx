// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { UniverseStrip } from './UniverseStrip.jsx';

afterEach(cleanup);

const activeEtf = {
  id: '069500',
  shortName: 'KODEX 200',
  category: '주식-시장대표',
  changePercent: 0.5,
};

const matchingEtf = {
  id: '396500',
  shortName: 'TIGER 반도체TOP10',
  category: '주식-섹터-반도체',
  changePercent: 1.51,
};

describe('UniverseStrip', () => {
  it('does not prepend the active ETF when it is outside the filtered results', () => {
    render(
      <UniverseStrip
        filteredEtfs={[matchingEtf]}
        activeEtf={activeEtf}
        activeId={activeEtf.id}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByText('KODEX 200')).toBeNull();
    expect(screen.getByText('TIGER 반도체TOP10')).toBeTruthy();
  });

  it('keeps the active ETF first when it matches the filtered results', () => {
    const { container } = render(
      <UniverseStrip
        filteredEtfs={[activeEtf, matchingEtf]}
        activeEtf={activeEtf}
        activeId={activeEtf.id}
        onSelect={vi.fn()}
      />,
    );

    const buttons = Array.from(container.querySelectorAll('.universe-list button'));
    expect(buttons.map((button) => button.querySelector('span').textContent)).toEqual([
      'KODEX 200',
      'TIGER 반도체TOP10',
    ]);
  });
});
