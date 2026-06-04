export function collectMissingFields(etf) {
  const fields = [];
  const checks = {
    price: etf.price,
    changePercent: etf.changePercent,
    expenseRatio: etf.expenseRatio,
    aum: etf.aum,
    dividendYield: etf.dividendYield,
    inceptionDate: etf.inceptionDate,
    nav: etf.nav,
    'returns.m3': etf.returns?.m3,
    'returns.y1': etf.returns?.y1,
    'returns.y3Annualized': etf.returns?.y3Annualized,
    'returns.y5Annualized': etf.returns?.y5Annualized,
    'risk.volatility3yAnnualized': etf.risk?.volatility3yAnnualized,
    'risk.maxDrawdown3y': etf.risk?.maxDrawdown3y,
    'risk.sharpe3y': etf.risk?.sharpe3y,
    'risk.trackingError3y': etf.risk?.trackingError3y,
    'risk.informationRatio3y': etf.risk?.informationRatio3y,
  };

  for (const [field, value] of Object.entries(checks)) {
    if (value === null || value === undefined || value === '') fields.push(field);
  }

  if (!Array.isArray(etf.holdings) || !etf.holdings.length) fields.push('holdings');
  return fields;
}

export function normalizeEtfInput(raw) {
  return {
    ...raw,
    price: nullableNumber(raw.price),
    changePercent: nullableNumber(raw.changePercent),
    expenseRatio: nullableNumber(raw.expenseRatio),
    aum: nullableNumber(raw.aum),
    dividendYield: nullableNumber(raw.dividendYield),
    returns: {
      m3: nullableNumber(raw.returns?.m3),
      y1: nullableNumber(raw.returns?.y1),
      y3Annualized: nullableNumber(raw.returns?.y3Annualized),
      y5Annualized: nullableNumber(raw.returns?.y5Annualized),
    },
    risk: {
      volatility3yAnnualized: nullableNumber(raw.risk?.volatility3yAnnualized),
      maxDrawdown3y: nullableNumber(raw.risk?.maxDrawdown3y),
      sharpe3y: nullableNumber(raw.risk?.sharpe3y),
      trackingError3y: nullableNumber(raw.risk?.trackingError3y),
      informationRatio3y: nullableNumber(raw.risk?.informationRatio3y),
    },
    holdings: Array.isArray(raw.holdings)
      ? raw.holdings.map((holding) => ({
          name: String(holding.name ?? '').trim(),
          ticker: holding.ticker ? String(holding.ticker).trim() : null,
          weight: nullableNumber(holding.weight),
        })).filter((holding) => holding.name && holding.weight !== null)
      : [],
  };
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
