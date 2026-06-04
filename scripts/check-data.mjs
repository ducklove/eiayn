import { readFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_IDS = ['360750', '379800', '458730', '069500', '091160', 'QQQ', 'VTI', 'SOXX', 'SCHD', 'ARKK'];
const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'etfs.json');

const raw = await readFile(DATA_FILE, 'utf8');
const payload = JSON.parse(raw);
const errors = [];

if (!payload.generatedAt) errors.push('generatedAt is required');
if (!Array.isArray(payload.etfs)) errors.push('etfs must be an array');
if ((payload.etfs ?? []).length !== REQUIRED_IDS.length) {
  errors.push(`expected ${REQUIRED_IDS.length} ETFs, found ${(payload.etfs ?? []).length}`);
}

const byId = new Map((payload.etfs ?? []).map((etf) => [etf.id, etf]));
for (const id of REQUIRED_IDS) {
  if (!byId.has(id)) errors.push(`missing required ETF ${id}`);
}

for (const etf of payload.etfs ?? []) {
  for (const field of [
    'id',
    'ticker',
    'name',
    'shortName',
    'provider',
    'market',
    'assetClass',
    'theme',
    'category',
    'benchmarkIndex',
    'currency',
    'returns',
    'risk',
    'dataQuality',
  ]) {
    if (etf[field] === undefined || etf[field] === null || etf[field] === '') {
      errors.push(`${etf.id}: missing ${field}`);
    }
  }

  if (!isFiniteNumber(etf.price)) errors.push(`${etf.id}: price must be a number`);
  if (!Array.isArray(etf.holdings)) errors.push(`${etf.id}: holdings must be an array`);
  if (!Array.isArray(etf.sparkline)) errors.push(`${etf.id}: sparkline must be an array`);
  if (!Array.isArray(etf.dataQuality?.sources) || !etf.dataQuality.sources.length) {
    errors.push(`${etf.id}: dataQuality.sources must not be empty`);
  }

  for (const [key, value] of Object.entries(etf.returns ?? {})) {
    if (!isNumberOrNull(value)) errors.push(`${etf.id}: returns.${key} must be number or null`);
  }

  for (const [key, value] of Object.entries(etf.risk ?? {})) {
    if (!isNumberOrNull(value)) errors.push(`${etf.id}: risk.${key} must be number or null`);
  }
}

for (const forbidden of ['demo', 'example', 'mock', '예시', '데모']) {
  if (raw.toLowerCase().includes(forbidden)) {
    errors.push(`production data contains forbidden token: ${forbidden}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`[check:data] OK: ${payload.etfs.length} ETFs, generatedAt=${payload.generatedAt}`);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumberOrNull(value) {
  return value === null || isFiniteNumber(value);
}
