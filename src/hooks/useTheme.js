import { useCallback, useEffect, useState } from 'react';
import { shell } from '../lib/ecosystem.js';

// Shared Value Compass theme key (plain 'light' | 'dark', no JSON). The legacy
// 'eiayn:theme:v1' value is migrated into it by the pre-paint boot block in
// index.html, which also applies `?theme=light|dark` without storing it.
export const THEME_STORAGE_KEY = 'theme';

const isTheme = (value) => value === 'light' || value === 'dark';

function systemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function storedTheme() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function initialTheme() {
  const applied = document.documentElement.dataset.theme;
  if (isTheme(applied)) return applied;
  const fromShell = shell()?.getTheme?.();
  if (isTheme(fromShell)) return fromShell;
  return storedTheme() ?? systemTheme();
}

// Fallback when vc-shell.js did not load: same contract as VCShell.setTheme.
function persistTheme(next) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage blocked (privacy mode): the theme still applies to this page.
  }
  const params = new URLSearchParams(window.location.search);
  if (isTheme(params.get('theme'))) {
    params.delete('theme');
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    );
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // The shell announces every change (its own toggle, other tabs via the
  // storage event, OS scheme changes, the hub's postMessage when framed).
  useEffect(() => {
    const onThemeChange = (event) => {
      if (isTheme(event.detail?.theme)) setTheme(event.detail.theme);
    };
    document.addEventListener('vc:themechange', onThemeChange);
    return () => document.removeEventListener('vc:themechange', onThemeChange);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const api = shell();
    if (typeof api?.setTheme === 'function') api.setTheme(next);
    else persistTheme(next);
    setTheme(next);
  }, [theme]);

  return [theme, toggleTheme];
}
