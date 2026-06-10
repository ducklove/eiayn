import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'etfs.json');
const MINIMUMS = {
  국내: 1000,
  미국: 100,
  홍콩: 5,
  독일: 5,
  프랑스: 5,
  일본: 5,
  호주: 5,
  베트남: 4,
};
const REQUIRED_KOREA_IDS = ['360750', '379800', '458730', '069500', '091160'];
const REQUIRED_US_IDS = ['QQQ', 'VTI', 'SOXX', 'SCHD', 'ARKK'];
const REQUIRED_REGIONAL_IDS = ['FUEVFVND.VN'];
const REQUIRED_REGIONAL_EXPENSE_MARKETS = ['홍콩', '독일', '프랑스', '일본', '호주', '베트남'];
const REQUIRED_USER_REQUEST_IDS = [
  'SIVR',
  'PPLT',
  'EUN2.DE',
  'DAX',
  '83188.HK',
  '3188.HK',
  'EWM',
  'A200.AX',
  'AAA.AX',
  '83199.HK',
  '3199.HK',
  'SCHP',
];
const REQUIRED_ALIASES = {
  DAX: 'DAX.O',
  SCHP: 'SCHP.K',
};

const raw = await readFile(DATA_FILE, 'utf8');
const payload = JSON.parse(raw);
const errors = [];

if (!payload.generatedAt) errors.push('generatedAt is required');
if (!Array.isArray(payload.etfs)) errors.push('etfs must be an array');
if (!payload.coverage?.korea) errors.push('coverage.korea is required');
if (!Array.isArray(payload.sources) || !payload.sources.length) errors.push('sources must not be empty');

const etfs = payload.etfs ?? [];
const byId = new Map(etfs.map((etf) => [etf.id, etf]));
const marketCounts = countBy(etfs, 'market');

for (const [market, minimum] of Object.entries(MINIMUMS)) {
  if ((marketCounts[market] ?? 0) < minimum) {
    errors.push(`${market}: expected at least ${minimum} ETFs, found ${marketCounts[market] ?? 0}`);
  }
}

if (payload.coverage?.korea?.sourceTotal && payload.coverage.korea.included !== payload.coverage.korea.sourceTotal) {
  errors.push(`Korea coverage mismatch: included ${payload.coverage.korea.included}, sourceTotal ${payload.coverage.korea.sourceTotal}`);
}

for (const id of [...REQUIRED_KOREA_IDS, ...REQUIRED_US_IDS, ...REQUIRED_REGIONAL_IDS, ...REQUIRED_USER_REQUEST_IDS]) {
  if (!byId.has(id)) errors.push(`missing required ETF ${id}`);
}

for (const [id, alias] of Object.entries(REQUIRED_ALIASES)) {
  const etf = byId.get(id);
  if (etf && !(etf.aliases ?? []).includes(alias)) {
    errors.push(`${id}: missing requested alias ${alias}`);
  }
}

for (const etf of etfs) {
  for (const field of [
    'id',
    'ticker',
    'name',
    'shortName',
    'market',
    'currency',
    'returns',
    'risk',
    'scoreBreakdown',
    'dataQuality',
  ]) {
    if (etf[field] === undefined || etf[field] === null || etf[field] === '') {
      errors.push(`${etf.id}: missing ${field}`);
    }
  }

  if (Object.hasOwn(etf, 'provider') === false) errors.push(`${etf.id}: provider field missing`);
  if (Object.hasOwn(etf, 'assetClass') === false) errors.push(`${etf.id}: assetClass field missing`);
  if (Object.hasOwn(etf, 'theme') === false) errors.push(`${etf.id}: theme field missing`);
  if (Object.hasOwn(etf, 'category') === false) errors.push(`${etf.id}: category field missing`);
  if (Object.hasOwn(etf, 'benchmarkIndex') === false) errors.push(`${etf.id}: benchmarkIndex field missing`);
  if (!isFiniteNumber(etf.price)) errors.push(`${etf.id}: price must be a number`);
  if (REQUIRED_REGIONAL_EXPENSE_MARKETS.includes(etf.market) && !isFiniteNumber(etf.expenseRatio)) {
    errors.push(`${etf.id}: regional ETF expenseRatio is required`);
  }
  if (!Array.isArray(etf.holdings)) errors.push(`${etf.id}: holdings must be an array`);
  if (!Array.isArray(etf.sparkline)) errors.push(`${etf.id}: sparkline must be an array`);
  if (!Array.isArray(etf.dataQuality?.sources) || !etf.dataQuality.sources.length) {
    errors.push(`${etf.id}: dataQuality.sources must not be empty`);
  }
  if (Object.hasOwn(etf.scoreBreakdown ?? {}, '수익성')) errors.push(`${etf.id}: legacy scoreBreakdown.수익성 must not be present`);
  if (Object.hasOwn(etf.scoreBreakdown ?? {}, '총보수')) errors.push(`${etf.id}: scoreBreakdown.총보수 must not be present`);
  for (const field of ['단기 수익', '장기 수익', '가치', '안정성', '분산', '효율성']) {
    if (Object.hasOwn(etf.scoreBreakdown ?? {}, field) === false) {
      errors.push(`${etf.id}: scoreBreakdown.${field} is required`);
    } else if (!isNumberOrNull(etf.scoreBreakdown[field])) {
      errors.push(`${etf.id}: scoreBreakdown.${field} must be number or null`);
    }
  }

  for (const [key, value] of Object.entries(etf.returns ?? {})) {
    if (!isNumberOrNull(value)) errors.push(`${etf.id}: returns.${key} must be number or null`);
  }

  for (const [key, value] of Object.entries(etf.risk ?? {})) {
    if (!isNumberOrNull(value)) errors.push(`${etf.id}: risk.${key} must be number or null`);
  }
}

// Forbidden-token scan covers only self-authored text (ETF labels and source
// names), not the raw JSON, so a real upstream holding named e.g. "Demo Corp"
// cannot fail the build.
const selfAuthoredText = [
  ...etfs.flatMap((etf) => [etf.name, etf.shortName, etf.provider, etf.theme, etf.category]),
  ...(payload.sources ?? []).map((source) => source?.name),
].filter((value) => typeof value === 'string');

for (const forbidden of [/\bdemo\b/i, /\bexample\b/i, /\bmock\b/i, /예시/, /데모/]) {
  const match = selfAuthoredText.find((text) => forbidden.test(text));
  if (match !== undefined) {
    errors.push(`production data contains forbidden token: ${forbidden} in "${match}"`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`[check:data] OK: ${etfs.length} ETFs, markets=${JSON.stringify(marketCounts)}, generatedAt=${payload.generatedAt}`);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumberOrNull(value) {
  return value === null || isFiniteNumber(value);
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? '미분류';
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}
