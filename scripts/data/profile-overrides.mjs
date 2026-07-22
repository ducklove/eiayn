import { emptyProfile } from './shared.mjs';

export const PROFILE_OVERRIDES = {
  'STW.AX': {
    expenseRatio: 0.05,
    source: {
      name: 'State Street ETF profile',
      url: 'https://www.ssga.com/au/en_gb/individual/etfs/spdr-spasx-200-etf-stw',
      fields: ['expenseRatio'],
    },
  },
  '1365.T': {
    expenseRatio: 0.825,
    source: {
      name: 'JPX ETF profile',
      url: 'https://www.jpx.co.jp/equities/products/etfs/leveraged-inverse/files/1365-j.pdf',
      fields: ['expenseRatio'],
    },
  },
  // StockAnalysis stopped publishing expenseRatio for these two around
  // 2026-07 (expenseRatio: void 0 in the page payload) and Yahoo quoteSummary
  // has no value either; values match the issuers' published management fees
  // and the last scraped snapshot (2026-06-25).
  'ETHI.AX': {
    expenseRatio: 0.59,
    source: {
      name: 'Betashares fund profile',
      url: 'https://www.betashares.com.au/fund/global-sustainability-leaders-etf/',
      fields: ['expenseRatio'],
    },
  },
  'FUEVFVND.VN': {
    expenseRatio: 0.8,
    source: {
      name: 'Dragon Capital DCVFM fund profile',
      url: 'https://dcvfm.com.vn/quy-etf-dcvfmvn-diamond/',
      fields: ['expenseRatio'],
    },
  },
};

export function profileOverrideForTicker(ticker) {
  const override = PROFILE_OVERRIDES[String(ticker ?? '').toUpperCase()];
  if (!override) return emptyProfile();
  return {
    ...emptyProfile(),
    ...override,
  };
}
