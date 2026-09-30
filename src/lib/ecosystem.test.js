// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HELD_FRAGMENT_TIMEOUT_MS,
  hubStockCode,
  scheduleHeldFragmentCleanup,
  sectionFromHash,
  stripHeldFragment,
  syncShellStock,
} from './ecosystem.js';

afterEach(() => {
  delete window.VCShell;
  window.history.replaceState(null, '', '/');
  vi.useRealTimers();
});

describe('hubStockCode', () => {
  it('accepts domestic 6-character codes only', () => {
    expect(hubStockCode({ id: '069500', market: '국내' })).toBe('069500');
    expect(hubStockCode({ id: '0091p0', market: '국내' })).toBe('0091P0');
    expect(hubStockCode({ id: 'SCHD', market: '미국' })).toBeNull();
    expect(hubStockCode({ id: '1321.T', market: '일본' })).toBeNull();
    expect(hubStockCode({ id: '3188HK', market: '홍콩' })).toBeNull();
    expect(hubStockCode({ id: '12345', market: '국내' })).toBeNull();
    expect(hubStockCode(null)).toBeNull();
  });
});

describe('syncShellStock', () => {
  it('is a no-op without the shell', () => {
    expect(() => syncShellStock({ id: '069500', market: '국내' })).not.toThrow();
  });

  it('sets the hub stock chip for domestic ETFs and clears it otherwise', () => {
    const setStock = vi.fn();
    window.VCShell = { setStock };
    syncShellStock({ id: '069500', market: '국내', shortName: ' KODEX 200 ', name: 'x' });
    expect(setStock).toHaveBeenLastCalledWith('069500', 'KODEX 200');
    syncShellStock({ id: 'QQQ', market: '미국', shortName: 'QQQ' });
    expect(setStock).toHaveBeenLastCalledWith(null, null);
    syncShellStock(null);
    expect(setStock).toHaveBeenLastCalledWith(null, null);
  });
});

describe('#vc-held fragment handling', () => {
  it('never treats the holdings hand-off as a section anchor', () => {
    expect(sectionFromHash('#vc-held=069500:10')).toBe('');
    expect(sectionFromHash('#vc-held=069500:10&risk')).toBe('risk');
    expect(sectionFromHash('#risk')).toBe('risk');
    expect(sectionFromHash('')).toBe('');
  });

  it('strips only the vc-held segment and keeps the rest of the URL', () => {
    window.history.replaceState(null, '', '/eiayn/?code=069500#vc-held=069500:3&risk');
    expect(stripHeldFragment()).toBe(true);
    expect(window.location.search).toBe('?code=069500');
    expect(window.location.hash).toBe('#risk');
    expect(stripHeldFragment()).toBe(false);
  });

  it('clears an unconsumed fragment after the timeout (hub script unreachable)', () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/eiayn/#vc-held=069500:3');
    expect(scheduleHeldFragmentCleanup()).not.toBeNull();
    vi.advanceTimersByTime(HELD_FRAGMENT_TIMEOUT_MS - 1);
    expect(window.location.hash).toBe('#vc-held=069500:3');
    vi.advanceTimersByTime(1);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/eiayn/');
  });

  it('does not schedule anything without a hand-off fragment', () => {
    window.history.replaceState(null, '', '/eiayn/#risk');
    expect(scheduleHeldFragmentCleanup()).toBeNull();
  });
});
