// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { usePersistentState } from './usePersistentState.js';

const KEY = 'eiayn:test:v1';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('usePersistentState', () => {
  it('reads the initial value from localStorage', () => {
    window.localStorage.setItem(KEY, JSON.stringify(['069500', '360750']));
    const { result } = renderHook(() => usePersistentState(KEY, []));
    expect(result.current[0]).toEqual(['069500', '360750']);
  });

  it('falls back to the initial value when storage is empty', () => {
    const { result } = renderHook(() => usePersistentState(KEY, 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('falls back to the initial value when stored JSON is corrupt', () => {
    window.localStorage.setItem(KEY, '{not-json');
    const { result } = renderHook(() => usePersistentState(KEY, 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('skips the first redundant write, then persists later changes', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => usePersistentState(KEY, 'initial'));
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(KEY)).toBeNull();

    act(() => {
      result.current[1]('updated');
    });
    expect(result.current[0]).toBe('updated');
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify('updated'));
  });

  it('supports functional updates', () => {
    const { result } = renderHook(() => usePersistentState(KEY, 1));
    act(() => {
      result.current[1]((current) => current + 1);
    });
    expect(result.current[0]).toBe(2);
    expect(window.localStorage.getItem(KEY)).toBe('2');
  });

  it('keeps the in-memory state when storage writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const { result } = renderHook(() => usePersistentState(KEY, 'initial'));
    act(() => {
      result.current[1]('memory-only');
    });
    expect(result.current[0]).toBe('memory-only');
  });
});
