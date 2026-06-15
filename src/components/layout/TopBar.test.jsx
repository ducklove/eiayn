// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TopBar } from './TopBar.jsx';

afterEach(cleanup);

const baseEtf = {
  id: '396500',
  shortName: 'TIGER 반도체TOP10',
  market: '국내',
  provider: '미래에셋자산운용',
  changePercent: 1.51,
};

function renderTopBar(props = {}) {
  return render(
    <TopBar
      query="TIGER"
      onQueryChange={vi.fn()}
      exchangeRate={null}
      theme="light"
      onToggleTheme={vi.fn()}
      searchResults={[baseEtf]}
      searchResultCount={1}
      onOpenSearchResult={vi.fn()}
      {...props}
    />,
  );
}

describe('TopBar search', () => {
  it('opens the first result when pressing Enter in the integrated search', () => {
    const onOpenSearchResult = vi.fn();
    renderTopBar({ onOpenSearchResult });

    const input = screen.getByPlaceholderText('ETF, 지수, 테마, 종목, 운용사 검색');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onOpenSearchResult).toHaveBeenCalledWith('396500');
  });

  it('shows clickable search results for the current query', () => {
    const onOpenSearchResult = vi.fn();
    renderTopBar({ onOpenSearchResult });

    fireEvent.focus(screen.getByPlaceholderText('ETF, 지수, 테마, 종목, 운용사 검색'));
    const result = screen.getByRole('option');
    expect(screen.getByText('1개 검색됨')).toBeTruthy();

    fireEvent.mouseDown(result);
    fireEvent.click(result);

    expect(onOpenSearchResult).toHaveBeenCalledWith('396500');
  });

  it('shows an empty state when the query has no matches', () => {
    renderTopBar({ searchResults: [], searchResultCount: 0 });

    fireEvent.focus(screen.getByPlaceholderText('ETF, 지수, 테마, 종목, 운용사 검색'));

    expect(screen.getByText('검색 조건에 맞는 ETF가 없습니다.')).toBeTruthy();
  });
});
