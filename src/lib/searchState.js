import { DEFAULT_FILTERS, getRiskBand } from './search.js';

// URL key for each filter. The ETF theme filter uses `etf_theme` because
// `?theme=light|dark` is the Value Compass ecosystem's visual-theme parameter
// (applied by the pre-paint boot block in index.html, never stored).
export const FILTER_URL_KEYS = {
  market: 'market',
  theme: 'etf_theme',
  provider: 'provider',
  risk: 'risk',
};

const VISUAL_THEMES = new Set(['light', 'dark']);

export function isVisualTheme(value) {
  return VISUAL_THEMES.has(value);
}

// Legacy links used `?theme=<ETF 테마>`; only values other than light|dark are
// still read as the filter.
function legacyEtfTheme(params) {
  const value = params.get('theme');
  return value && !isVisualTheme(value) ? value : null;
}

function readFilterValue(params, key) {
  const value = params.get(FILTER_URL_KEYS[key]);
  if (value) return value;
  return key === 'theme' ? legacyEtfTheme(params) : null;
}

export function readSearchState(params, etfs) {
  const filters = { ...DEFAULT_FILTERS };
  for (const key of Object.keys(filters)) {
    const value = readFilterValue(params, key);
    if (value && etfs.some((etf) => (key === 'risk' ? getRiskBand(etf) : etf[key]) === value)) {
      filters[key] = value;
    }
  }
  return { query: params.get('q') ?? '', filters };
}

export function writeSearchParams(params, query = '', filters = DEFAULT_FILTERS) {
  if (query.trim()) params.set('q', query);
  else params.delete('q');
  // A legacy `?theme=<ETF 테마>` is rewritten to `etf_theme`; `?theme=light|dark` is kept.
  if (legacyEtfTheme(params)) params.delete('theme');
  for (const [key, allLabel] of Object.entries(DEFAULT_FILTERS)) {
    const urlKey = FILTER_URL_KEYS[key];
    if (filters[key] && filters[key] !== allLabel) params.set(urlKey, filters[key]);
    else params.delete(urlKey);
  }
  return params;
}

// Ecosystem parameters that must survive in-app navigation (pushState URLs are
// rebuilt from scratch): the visual theme and the chrome-less embed mode.
export function carryShellParams(params, current) {
  const theme = current.get('theme');
  if (isVisualTheme(theme)) params.set('theme', theme);
  for (const key of ['embed', 'vc-shell']) {
    const value = current.get(key);
    if (value !== null) params.set(key, value);
  }
  return params;
}

// `?embed` (any value except 0/false) hides the app chrome; the boot block in
// index.html sets html[data-embed]. The value may name a view (list, ranking…).
export function readEmbed(params) {
  const value = params.get('embed');
  if (value === null || value === '0' || value === 'false') return null;
  return { view: value && value !== '1' && value !== 'true' ? value.trim().toLowerCase() : null };
}
