// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useDocumentTitle } from './useDocumentTitle.js';

const etf = { shortName: 'KODEX 200' };

afterEach(() => {
  cleanup();
  document.title = '';
});

describe('useDocumentTitle', () => {
  it('shows the ETF name in the analysis view', () => {
    renderHook(() => useDocumentTitle('analysis', etf));
    expect(document.title).toBe('KODEX 200 분석 — ETF is All You Need');
  });

  it('shows the list label in the list view', () => {
    renderHook(() => useDocumentTitle('list', etf));
    expect(document.title).toBe('전체 목록 — ETF is All You Need');
  });

  it('uses the base title in the compare view', () => {
    renderHook(() => useDocumentTitle('compare', etf));
    expect(document.title).toBe('ETF is All You Need');
  });

  it('is null-safe when the analysis view has no selected ETF', () => {
    renderHook(() => useDocumentTitle('analysis', null));
    expect(document.title).toBe('ETF is All You Need');
  });

  it('is null-safe when the selected ETF lacks a short name', () => {
    renderHook(() => useDocumentTitle('analysis', {}));
    expect(document.title).toBe('ETF is All You Need');
  });

  it('updates when the view or selection changes', () => {
    const { rerender } = renderHook(
      ({ viewMode, selectedEtf }) => useDocumentTitle(viewMode, selectedEtf),
      { initialProps: { viewMode: 'compare', selectedEtf: etf } },
    );
    expect(document.title).toBe('ETF is All You Need');

    rerender({ viewMode: 'analysis', selectedEtf: { shortName: 'TIGER 미국S&P500' } });
    expect(document.title).toBe('TIGER 미국S&P500 분석 — ETF is All You Need');

    rerender({ viewMode: 'list', selectedEtf: null });
    expect(document.title).toBe('전체 목록 — ETF is All You Need');
  });
});
