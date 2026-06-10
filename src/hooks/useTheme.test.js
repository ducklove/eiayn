// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useTheme } from './useTheme.js';

const STORAGE_KEY = 'eiayn:theme:v1';

function mockMatchMedia(matches) {
  const matchMedia = vi.fn().mockReturnValue({ matches });
  window.matchMedia = matchMedia;
  return matchMedia;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete window.matchMedia;
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe('useTheme', () => {
  it('defaults to dark when the system prefers dark', () => {
    const matchMedia = mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('defaults to light when the system prefers light', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('defaults to light when matchMedia is unavailable', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('light');
  });

  it('prefers the persisted theme over the system theme', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify('dark'));
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('does not persist the initial theme', () => {
    mockMatchMedia(true);
    renderHook(() => useTheme());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('toggles the document theme and persists each change', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify('dark'));

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify('light'));
  });
});
