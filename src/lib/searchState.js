import { DEFAULT_FILTERS, getRiskBand } from './search.js';

export function readSearchState(params, etfs) {
  const filters = { ...DEFAULT_FILTERS };
  for (const key of Object.keys(filters)) {
    const value = params.get(key);
    if (value && etfs.some((etf) => (key === 'risk' ? getRiskBand(etf) : etf[key]) === value)) {
      filters[key] = value;
    }
  }
  return { query: params.get('q') ?? '', filters };
}

export function writeSearchParams(params, query = '', filters = DEFAULT_FILTERS) {
  if (query.trim()) params.set('q', query);
  else params.delete('q');
  for (const [key, allLabel] of Object.entries(DEFAULT_FILTERS)) {
    if (filters[key] && filters[key] !== allLabel) params.set(key, filters[key]);
    else params.delete(key);
  }
  return params;
}
