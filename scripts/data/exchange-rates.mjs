import { fetchYahooChart } from './yahoo.mjs';

// 모든 통화의 일별 종가가 존재하는 가장 최근 날짜를 사용합니다.
export function buildExchangeRates(charts, collectedAt) {
  const currencies = Object.keys(charts);
  const maps = currencies.map((currency) => {
    const points = (charts[currency]?.series ?? []).filter(
      (point) =>
        /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.close) && point.close > 0,
    );
    return new Map(points.map((point) => [point.date, point.close]));
  });
  const cutoff = collectedAt.slice(0, 10);
  const commonDates = maps.length
    ? [...maps[0].keys()]
        .filter((date) => date <= cutoff && maps.every((map) => map.has(date)))
        .sort()
    : [cutoff];
  const asOf = commonDates.at(-1);
  if (!asOf || Date.parse(cutoff) - Date.parse(asOf) > 7 * 86_400_000) {
    throw new Error('전체 통화의 최근 공통 기준일 환율을 확보하지 못했습니다.');
  }
  return {
    base: 'USD',
    asOf,
    collectedAt,
    ratesToUsd: Object.fromEntries([
      ['USD', 1],
      ...currencies.map((currency, i) => [currency, 1 / maps[i].get(asOf)]),
    ]),
    sources: currencies.map((currency) => ({
      currency,
      name: 'Yahoo Finance chart',
      url: charts[currency].url,
    })),
  };
}

export async function fetchAumExchangeRates(currencies, collectedAt = new Date().toISOString()) {
  const requested = [...new Set(currencies)].filter((currency) => currency !== 'USD');
  if (requested.some((currency) => !/^[A-Z]{3}$/.test(currency)))
    throw new Error('지원하지 않는 통화 코드');
  const entries = await Promise.all(
    requested.map(async (currency) => [currency, await fetchYahooChart(`USD${currency}=X`, '1mo')]),
  );
  return buildExchangeRates(Object.fromEntries(entries), collectedAt);
}
