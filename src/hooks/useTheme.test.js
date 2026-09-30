// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { THEME_STORAGE_KEY, useTheme } from './useTheme.js';

function mockMatchMedia(matches) {
  const matchMedia = vi.fn().mockReturnValue({ matches });
  window.matchMedia = matchMedia;
  return matchMedia;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete window.matchMedia;
  delete window.VCShell;
  delete document.documentElement.dataset.theme;
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('useTheme', () => {
  it('uses the shared ecosystem storage key', () => {
    expect(THEME_STORAGE_KEY).toBe('theme');
  });

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

  it('prefers the persisted shared theme over the system theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('starts from the theme the pre-paint boot block applied (e.g. ?theme=dark)', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    document.documentElement.dataset.theme = 'dark';
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('does not persist the initial theme', () => {
    mockMatchMedia(true);
    renderHook(() => useTheme());
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('toggles and persists plain values under the shared key without the shell', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('drops a one-off ?theme= from the URL once the user picks a theme', () => {
    window.history.replaceState(null, '', '/?theme=dark&code=069500#risk');
    document.documentElement.dataset.theme = 'dark';
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current[1]();
    });
    expect(window.location.search).toBe('?code=069500');
    expect(window.location.hash).toBe('#risk');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('delegates the toggle to VCShell.setTheme when the shell is loaded', () => {
    const setTheme = vi.fn();
    window.VCShell = { getTheme: () => 'light', setTheme };
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current[1]();
    });
    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(result.current[0]).toBe('dark');
    // The shell owns persistence; the hook does not write storage itself.
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('follows vc:themechange events (shell toggle, other tabs, hub postMessage)', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    act(() => {
      document.dispatchEvent(new CustomEvent('vc:themechange', { detail: { theme: 'dark' } }));
    });
    expect(result.current[0]).toBe('dark');
    act(() => {
      document.dispatchEvent(new CustomEvent('vc:themechange', { detail: { theme: 'bogus' } }));
    });
    expect(result.current[0]).toBe('dark');
  });
});
