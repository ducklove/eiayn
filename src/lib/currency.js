// 금액의 통화가 확인되지 않으면 원금액을 다른 통화와 비교하지 않습니다.
export function comparableAum(etf) {
  const value = etf.aumUsd ?? (etf.currency === 'USD' ? etf.aum : null);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function applyAumExchangeRates(etfs, fx) {
  return etfs.map((etf) => {
    const rate = fx?.ratesToUsd?.[etf.currency];
    const valid = Number.isFinite(rate) && rate > 0 && Number.isFinite(etf.aum) && etf.aum > 0;
    return { ...etf, aumUsd: valid ? etf.aum * rate : null, aumFxAsOf: valid ? fx.asOf : null };
  });
}
