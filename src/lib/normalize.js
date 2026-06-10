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
