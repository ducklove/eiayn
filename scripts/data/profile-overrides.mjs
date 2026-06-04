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
};

export function profileOverrideForTicker(ticker) {
  const override = PROFILE_OVERRIDES[String(ticker ?? '').toUpperCase()];
  if (!override) return emptyProfile();
  return {
    ...emptyProfile(),
    ...override,
  };
}

function emptyProfile() {
  return {
    source: null,
    expenseRatio: null,
    aum: null,
    dividendYield: null,
    inceptionDate: null,
  };
}
