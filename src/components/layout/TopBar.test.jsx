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
      onShowSearchResults={vi.fn()}
      {...props}
    />,
  );
}

describe('TopBar search', () => {
  it('opens all results when pressing Enter without a keyboard selection', () => {
    const onOpenSearchResult = vi.fn();
    const onShowSearchResults = vi.fn();
    renderTopBar({ onOpenSearchResult, onShowSearchResults });

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onShowSearchResults).toHaveBeenCalledOnce();
    expect(onOpenSearchResult).not.toHaveBeenCalled();
  });

  it('shows clickable search results for the current query', () => {
    const onOpenSearchResult = vi.fn();
    renderTopBar({ onOpenSearchResult });

    fireEvent.focus(screen.getByRole('combobox'));
    const result = screen.getByRole('option');
    expect(screen.getByText('전체 ETF에서 1개 검색됨')).toBeTruthy();

    fireEvent.mouseDown(result);
    fireEvent.click(result);

    expect(onOpenSearchResult).toHaveBeenCalledWith('396500');
  });

  it('shows an empty state when the query has no matches', () => {
    renderTopBar({ searchResults: [], searchResultCount: 0 });

    fireEvent.focus(screen.getByRole('combobox'));

    expect(screen.getByText('“TIGER”에 맞는 ETF가 없습니다.')).toBeTruthy();
  });

  it('opens the chosen result with arrow keys and exposes the active option', () => {
    const onOpenSearchResult = vi.fn();
    renderTopBar({
      onOpenSearchResult,
      searchResults: [baseEtf, { ...baseEtf, id: 'QQQ', shortName: 'QQQ' }],
    });
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).toBe('search-option-1');
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onOpenSearchResult).toHaveBeenCalledWith('QQQ');
  });

  it('does not navigate while Korean input is being composed', () => {
    const onShowSearchResults = vi.fn();
    const onOpenSearchResult = vi.fn();
    renderTopBar({ onShowSearchResults, onOpenSearchResult });
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(onShowSearchResults).not.toHaveBeenCalled();
    expect(onOpenSearchResult).not.toHaveBeenCalled();
  });

  it('keeps the popup open when focus moves to the full-results button', () => {
    const onShowSearchResults = vi.fn();
    renderTopBar({ onShowSearchResults });
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    const button = screen.getByRole('button', { name: '검색 결과 1개 전체 보기' });
    fireEvent.blur(input, { relatedTarget: button });
    fireEvent.click(button);
    expect(onShowSearchResults).toHaveBeenCalledOnce();
  });

  it('shows examples before typing and clears the query explicitly', () => {
    const onQueryChange = vi.fn();
    const { rerender } = renderTopBar({ query: '', onQueryChange });
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('button', { name: 'KODEX200' }));
    expect(onQueryChange).toHaveBeenCalledWith('KODEX200');
    rerender(<TopBar query="KODEX200" onQueryChange={onQueryChange} />);
    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(onQueryChange).toHaveBeenLastCalledWith('');
  });

  it('hides stale suggestions until the current query finishes', () => {
    const onOpenSearchResult = vi.fn();
    const { rerender } = renderTopBar({ onOpenSearchResult });
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    rerender(
      <TopBar
        query="QQQ"
        searchPending
        searchResults={[baseEtf]}
        onOpenSearchResult={onOpenSearchResult}
      />,
    );
    expect(screen.queryByRole('option')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onOpenSearchResult).not.toHaveBeenCalled();
  });
});
