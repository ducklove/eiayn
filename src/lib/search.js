export const DEFAULT_FILTERS = {
  market: '시장 전체',
  theme: '테마 전체',
  provider: '운용사 전체',
  risk: '리스크 전체',
};

// 검색용 표기만 확장하며 원본 상품명과 보유종목 데이터는 유지합니다.
const ALIAS_GROUPS = [
  ['kodex', '코덱스'],
  ['tiger', '타이거'],
  ['nasdaq', '나스닥'],
  ['kospi', '코스피'],
  ['kosdaq', '코스닥'],
  ['nvidia', '엔비디아'],
  ['apple', '애플'],
  ['tesla', '테슬라'],
  ['microsoft', '마이크로소프트'],
  ['amazon', '아마존'],
  ['alphabet', 'google', '알파벳', '구글'],
  ['samsungelectronics', '삼성전자'],
  ['skhynix', 'sk하이닉스'],
];

export function buildSearchIndex(etfs) {
  return new Map(etfs.map((etf) => [etf.id, searchDocument(etf)]));
}

export function filterEtfs(etfs, query, filters = {}, index) {
  const terms = queryTerms(query);
  const matches = [];
  for (const etf of etfs) {
    if (!matchesFilters(etf, filters)) continue;
    const match = terms.length
      ? matchDocument(index?.get(etf.id) ?? searchDocument(etf), terms)
      : null;
    if (terms.length && !match) continue;
    matches.push({ etf, rank: match?.rank ?? 0 });
  }
  // 같은 관련도에서는 기존 스냅샷 순서를 유지합니다.
  if (terms.length) matches.sort((a, b) => a.rank - b.rank);
  return matches.map(({ etf }) => etf);
}

export function searchMatchLabel(etf, query, index) {
  const terms = queryTerms(query);
  return terms.length
    ? (matchDocument(index?.get(etf.id) ?? searchDocument(etf), terms)?.label ?? '')
    : '';
}

function matchesFilters(etf, filters) {
  return Object.entries(DEFAULT_FILTERS).every(([key, allLabel]) => {
    const value = filters[key];
    return !value || value === allLabel || (key === 'risk' ? getRiskBand(etf) : etf[key]) === value;
  });
}

function searchDocument(etf) {
  const codes = [etf.id, etf.ticker, etf.yahooSymbol, ...(etf.aliases ?? [])]
    .filter(Boolean)
    .map(normalizeText);
  const names = [etf.name, etf.shortName].filter(Boolean).map(normalizeText);
  const metadata = [
    etf.provider,
    etf.market,
    etf.assetClass,
    etf.theme,
    etf.category,
    etf.benchmarkIndex,
  ]
    .filter(Boolean)
    .map(normalizeText);
  const holdings = (etf.holdings ?? []).map((holding) => ({
    name: holding.name || holding.ticker,
    fields: [holding.name, holding.ticker].filter(Boolean).map(normalizeText).flatMap(withAliases),
  }));
  const identity = [...codes, ...names].flatMap(withAliases);
  const details = [...identity, ...metadata.flatMap(withAliases)];
  return {
    codes,
    names,
    identity,
    details,
    holdings,
    all: [...details, ...holdings.flatMap((item) => item.fields)],
  };
}

function queryTerms(query) {
  return String(query ?? '')
    .normalize('NFKC')
    .trim()
    .split(/\s+/)
    .map(normalizeText)
    .filter(Boolean);
}

function withAliases(field) {
  return [
    field,
    ...ALIAS_GROUPS.flatMap((group) => {
      const found = group.find((alias) => field.includes(alias));
      return found ? group.map((alias) => field.replaceAll(found, alias)) : [];
    }),
  ];
}

function matchesTerms(fields, terms) {
  return terms.every((term) => fields.some((field) => field.includes(term)));
}

function matchDocument(document, terms) {
  const phrase = terms.join('');
  if (document.codes.includes(phrase)) return { rank: 0, label: '종목코드 일치' };
  if (document.names.includes(phrase)) return { rank: 1, label: 'ETF명 일치' };
  if (matchesTerms(document.identity, terms)) return { rank: 2, label: 'ETF명·코드 일치' };
  if (matchesTerms(document.details, terms)) return { rank: 3, label: '운용사·지수·테마 일치' };
  const holding = document.holdings.find((item) => matchesTerms(item.fields, terms));
  if (holding) return { rank: 4, label: `보유종목: ${holding.name}` };
  if (matchesTerms(document.all, terms)) {
    return { rank: 5, label: '상품 정보·보유종목 일치' };
  }
  return null;
}

export function searchableText(etf) {
  return searchDocument(etf).all.join(' ');
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
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\p{S}\s]/gu, '');
}
