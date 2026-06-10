export function buildSearchIndex(etfs) {
  return new Map(etfs.map((etf) => [etf.id, searchableText(etf)]));
}

export function filterEtfs(etfs, query, filters, index) {
  const normalizedQuery = normalizeText(query);
  return etfs.filter((etf) => {
    const matchesQuery =
      !normalizedQuery || (index?.get(etf.id) ?? searchableText(etf)).includes(normalizedQuery);
    const matchesMarket =
      !filters.market || filters.market === '시장 전체' || etf.market === filters.market;
    const matchesTheme =
      !filters.theme || filters.theme === '테마 전체' || etf.theme === filters.theme;
    const matchesProvider =
      !filters.provider || filters.provider === '운용사 전체' || etf.provider === filters.provider;
    const matchesRisk =
      !filters.risk || filters.risk === '리스크 전체' || getRiskBand(etf) === filters.risk;
    return matchesQuery && matchesMarket && matchesTheme && matchesProvider && matchesRisk;
  });
}

export function searchableText(etf) {
  const holdings = (etf.holdings ?? [])
    .map((holding) => `${holding.name} ${holding.ticker ?? ''}`)
    .join(' ');
  return normalizeText(
    [
      etf.id,
      etf.ticker,
      ...(etf.aliases ?? []),
      etf.name,
      etf.shortName,
      etf.provider,
      etf.market,
      etf.assetClass,
      etf.theme,
      etf.category,
      etf.benchmarkIndex,
      holdings,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

export function getRiskBand(etf) {
  const volatility = etf.risk?.volatility3yAnnualized;
  if (typeof volatility !== 'number' || !Number.isFinite(volatility)) return '데이터 없음';
  if (volatility < 13) return '낮음';
  if (volatility < 22) return '보통';
  return '높음';
}

export function uniqueOptions(etfs, key, allLabel) {
  const values = Array.from(new Set(etfs.map((etf) => etf[key]).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'ko'),
  );
  return [allLabel, ...values];
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
