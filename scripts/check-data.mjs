import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const DATA_FILE = path.join(DATA_DIR, 'etfs.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CHANGES_FILE = path.join(DATA_DIR, 'changes.json');
const HISTORY_MAX_ENTRIES = 60;
const CHANGES_ARRAY_CAPS = { newListings: 50, delisted: 50, feeChanges: null, scoreMoves: 20 };
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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

if (payload.schemaVersion !== 2) errors.push('schemaVersion must be 2');
if (!payload.generatedAt) errors.push('generatedAt is required');
if (!Array.isArray(payload.etfs)) errors.push('etfs must be an array');
if (!payload.coverage?.korea) errors.push('coverage.korea is required');
if (!Array.isArray(payload.sources) || !payload.sources.length)
  errors.push('sources must not be empty');

const sourceCatalog = Array.isArray(payload.sourceCatalog) ? payload.sourceCatalog : [];
if (!sourceCatalog.length) {
  errors.push('sourceCatalog must be a non-empty array');
}
sourceCatalog.forEach((entry, index) => {
  if (!isNonEmptyString(entry?.name) || !isNonEmptyString(entry?.url)) {
    errors.push(`sourceCatalog[${index}]: name and url are required strings`);
  }
});

const etfs = payload.etfs ?? [];
const byId = new Map(etfs.map((etf) => [etf.id, etf]));
const marketCounts = countBy(etfs, 'market');
const excluded = Array.isArray(payload.coverage?.excluded) ? payload.coverage.excluded : [];

for (const [market, minimum] of Object.entries(MINIMUMS)) {
  if ((marketCounts[market] ?? 0) < minimum) {
    errors.push(`${market}: expected at least ${minimum} ETFs, found ${marketCounts[market] ?? 0}`);
  }
}

if (
  payload.coverage?.korea?.sourceTotal &&
  payload.coverage.korea.included + excludedCount(excluded, '국내') !==
    payload.coverage.korea.sourceTotal
) {
  errors.push(
    `Korea coverage mismatch: included ${payload.coverage.korea.included}, excluded ${excludedCount(excluded, '국내')}, sourceTotal ${payload.coverage.korea.sourceTotal}`,
  );
}

for (const id of [
  ...REQUIRED_KOREA_IDS,
  ...REQUIRED_US_IDS,
  ...REQUIRED_REGIONAL_IDS,
  ...REQUIRED_USER_REQUEST_IDS,
]) {
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
  if (Object.hasOwn(etf, 'assetClass') === false)
    errors.push(`${etf.id}: assetClass field missing`);
  if (Object.hasOwn(etf, 'theme') === false) errors.push(`${etf.id}: theme field missing`);
  if (Object.hasOwn(etf, 'category') === false) errors.push(`${etf.id}: category field missing`);
  if (Object.hasOwn(etf, 'benchmarkIndex') === false)
    errors.push(`${etf.id}: benchmarkIndex field missing`);
  if (!isFiniteNumber(etf.price)) errors.push(`${etf.id}: price must be a number`);
  if (REQUIRED_REGIONAL_EXPENSE_MARKETS.includes(etf.market) && !isFiniteNumber(etf.expenseRatio)) {
    errors.push(`${etf.id}: regional ETF expenseRatio is required`);
  }
  if (!Array.isArray(etf.holdings)) errors.push(`${etf.id}: holdings must be an array`);
  if (!Array.isArray(etf.sparkline)) errors.push(`${etf.id}: sparkline must be an array`);

  // nav is best-effort KRX data and must stay null-or-positive — never
  // estimated, never zero/negative.
  if (!(etf.nav === null || (isFiniteNumber(etf.nav) && etf.nav > 0))) {
    errors.push(`${etf.id}: nav must be null or a positive finite number`);
  }

  // premiumDiscount is optional like performance1y (snapshots written before
  // the KRX NAV enrichment keep validating); when the field is present it
  // must be null or a plausible percentage.
  if (etf.premiumDiscount !== undefined) {
    const premiumDiscount = etf.premiumDiscount;
    if (
      !(
        premiumDiscount === null ||
        (isFiniteNumber(premiumDiscount) && Math.abs(premiumDiscount) <= 50)
      )
    ) {
      errors.push(`${etf.id}: premiumDiscount must be null or a finite number with |x| <= 50`);
    }
  }

  // performance1y is optional (snapshots written before the field keep
  // validating); when present and non-null its shape is enforced.
  const performance = etf.performance1y;
  if (performance !== undefined && performance !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(performance?.start ?? '')) {
      errors.push(`${etf.id}: performance1y.start must be a YYYY-MM-DD string`);
    }
    if (performance?.freq !== 'weekly') {
      errors.push(`${etf.id}: performance1y.freq must be "weekly"`);
    }
    const values = performance?.values;
    if (!Array.isArray(values) || !values.length || !values.every(isFiniteNumber)) {
      errors.push(`${etf.id}: performance1y.values must be a non-empty array of finite numbers`);
    } else if (values[0] !== 100) {
      errors.push(`${etf.id}: performance1y.values[0] must be exactly 100`);
    }
  }
  const sourceRefs = etf.dataQuality?.sourceRefs;
  if (!Array.isArray(sourceRefs) || !sourceRefs.length) {
    errors.push(`${etf.id}: dataQuality.sourceRefs must not be empty`);
  } else if (
    !sourceRefs.every((ref) => Number.isInteger(ref) && ref >= 0 && ref < sourceCatalog.length)
  ) {
    errors.push(`${etf.id}: dataQuality.sourceRefs must be valid sourceCatalog indexes`);
  }
  if (Object.hasOwn(etf.scoreBreakdown ?? {}, '수익성'))
    errors.push(`${etf.id}: legacy scoreBreakdown.수익성 must not be present`);
  if (Object.hasOwn(etf.scoreBreakdown ?? {}, '총보수'))
    errors.push(`${etf.id}: scoreBreakdown.총보수 must not be present`);
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

// history.json and changes.json are optional sidecar files (they appear with
// the first data refresh after the history/changes pipeline shipped) and are
// validated only when present; a missing file is never an error.
const history = await readOptionalJson(HISTORY_FILE, 'history.json');
if (history !== null) validateHistory(history);

const changes = await readOptionalJson(CHANGES_FILE, 'changes.json');
if (changes !== null) validateChanges(changes);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(
  `[check:data] OK: ${etfs.length} ETFs, markets=${JSON.stringify(marketCounts)}, generatedAt=${payload.generatedAt}`,
);
console.log(
  `[check:data] history.json: ${history ? `${history.entries.length} entries` : 'absent (ok)'}, changes.json: ${changes ? 'present' : 'absent (ok)'}`,
);

// Returns the parsed JSON, or null when the file does not exist. Unreadable
// or unparseable committed files are validation errors, not crashes.
async function readOptionalJson(file, label) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    errors.push(`${label}: unreadable (${error.message})`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    errors.push(`${label}: invalid JSON (${error.message})`);
    return null;
  }
}

function validateHistory(history) {
  if (history.schemaVersion !== 1) errors.push('history.json: schemaVersion must be 1');
  if (!isNonEmptyString(history.updatedAt)) {
    errors.push('history.json: updatedAt must be an ISO datetime string');
  }
  if (!Array.isArray(history.entries)) {
    errors.push('history.json: entries must be an array');
    return;
  }
  if (history.entries.length > HISTORY_MAX_ENTRIES) {
    errors.push(`history.json: entries must be pruned to ${HISTORY_MAX_ENTRIES}`);
  }
  let previousDate = '';
  history.entries.forEach((entry, index) => {
    const where = `history.json entries[${index}]`;
    if (!DATE_PATTERN.test(entry?.date ?? '')) {
      errors.push(`${where}: date must be a YYYY-MM-DD string`);
      return;
    }
    if (entry.date <= previousDate) {
      errors.push(`${where}: dates must be unique and sorted ascending (${entry.date})`);
    }
    previousDate = entry.date;
    if (!isNonEmptyString(entry.generatedAt)) {
      errors.push(`${where}: generatedAt must be an ISO datetime string`);
    }
    if (!isPlainObject(entry.scores)) {
      errors.push(`${where}: scores must be an object`);
      return;
    }
    for (const [id, score] of Object.entries(entry.scores)) {
      if (!Number.isInteger(score)) {
        errors.push(`${where}: scores.${id} must be a finite integer`);
        break;
      }
    }
  });
}

function validateChanges(changes) {
  if (changes.schemaVersion !== 1) errors.push('changes.json: schemaVersion must be 1');
  if (!isNonEmptyString(changes.generatedAt)) {
    errors.push('changes.json: generatedAt must be an ISO datetime string');
  }
  if (changes.previousGeneratedAt !== null && !isNonEmptyString(changes.previousGeneratedAt)) {
    errors.push('changes.json: previousGeneratedAt must be an ISO datetime string or null');
  }
  for (const [key, cap] of Object.entries(CHANGES_ARRAY_CAPS)) {
    const list = changes[key];
    if (!Array.isArray(list)) {
      errors.push(`changes.json: ${key} must be an array`);
      continue;
    }
    if (cap !== null && list.length > cap) {
      errors.push(`changes.json: ${key} must be capped at ${cap}`);
    }
    list.forEach((entry, index) => {
      if (!isNonEmptyString(entry?.id)) {
        errors.push(`changes.json: ${key}[${index}].id must be a non-empty string`);
      }
      if (
        (key === 'feeChanges' || key === 'scoreMoves') &&
        (!isFiniteNumber(entry?.from) || !isFiniteNumber(entry?.to))
      ) {
        errors.push(`changes.json: ${key}[${index}] must carry numeric from/to values`);
      }
    });
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
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

function excludedCount(items, market) {
  return items.filter((item) => item?.market === market).length;
}
