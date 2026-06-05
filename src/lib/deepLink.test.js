import { describe, expect, it } from 'vitest';
import { findEtfByCode, resolveInitialSelection } from './deepLink.js';

describe('deep link utilities', () => {
  const etfs = [
    { id: 'QQQ', ticker: 'QQQ', yahooSymbol: 'QQQ' },
    { id: 'DAX', ticker: 'DAX', yahooSymbol: 'DAX', aliases: ['DAX.O'] },
    { id: 'SCHP', ticker: 'SCHP', yahooSymbol: 'SCHP', aliases: ['SCHP.K'] },
    { id: '3188.HK', ticker: '3188.HK', yahooSymbol: '3188.HK' },
  ];

  it('finds ETFs by id, ticker, Yahoo symbol, or alias', () => {
    expect(findEtfByCode(etfs, 'dax.o')?.id).toBe('DAX');
    expect(findEtfByCode(etfs, 'schp.k')?.id).toBe('SCHP');
    expect(findEtfByCode(etfs, '3188.hk')?.id).toBe('3188.HK');
  });

  it('makes code the active ETF and selected analysis target', () => {
    const params = new URLSearchParams('code=DAX.O&compare=QQQ,SCHP,3188.HK');
    const result = resolveInitialSelection(etfs, params);

    expect(result.activeId).toBe('DAX');
    expect(result.selectedIds).toEqual(['DAX']);
    expect(result.viewMode).toBe('analysis');
    expect(result.matchedCodeId).toBe('DAX');
  });

  it('falls back to defaults when code is unknown', () => {
    const params = new URLSearchParams('code=NOPE');
    const result = resolveInitialSelection(etfs, params);

    expect(result.activeId).toBe('QQQ');
    expect(result.selectedIds).toEqual(['QQQ', 'DAX', 'SCHP']);
    expect(result.viewMode).toBe('analysis');
    expect(result.requestedCode).toBe('NOPE');
    expect(result.matchedCodeId).toBeNull();
  });

  it('uses the comparison basket by default', () => {
    const result = resolveInitialSelection(etfs, new URLSearchParams(''));

    expect(result.activeId).toBe('QQQ');
    expect(result.selectedIds).toEqual(['QQQ', 'DAX', 'SCHP']);
    expect(result.viewMode).toBe('compare');
  });
});
