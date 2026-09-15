import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function buildResearch(snapshot, reviewedPairs) {
  if (!snapshot.generatedAt || !Array.isArray(snapshot.etfs))
    throw new Error('ETF 원천 스냅샷이 없습니다.');
  const byCode = new Map(snapshot.etfs.map((etf) => [etf.id, etf]));
  const seen = new Set();
  const pairs = reviewedPairs.map((pair) => {
    const a = byCode.get(pair.common),
      b = byCode.get(pair.preferred);
    const key = `${pair.common}:${pair.preferred}`;
    const normalize = (s) =>
      String(s ?? '')
        .replaceAll(/\s/g, '')
        .toUpperCase();
    if (
      !a ||
      !b ||
      a === b ||
      seen.has(key) ||
      a.currency !== 'KRW' ||
      b.currency !== 'KRW' ||
      normalize(a.benchmarkIndex) !== normalize(pair.expectedBenchmark) ||
      normalize(b.benchmarkIndex) !== normalize(pair.expectedBenchmark)
    )
      throw new Error('검토한 ETF 쌍과 원천 상품 정보가 다릅니다.');
    if (pair.execution_eligible !== false || pair.point_in_time_verified !== false)
      throw new Error('검증 전 실행 승인을 게시할 수 없습니다.');
    seen.add(key);
    return { ...pair };
  });
  return {
    schema_version: 1,
    provider: 'eiayn',
    data_as_of: snapshot.generatedAt,
    point_in_time_verified: false,
    execution_eligible: false,
    pairs,
    instruments: snapshot.etfs.map((e) => ({
      id: e.id,
      ticker: e.ticker,
      name: e.name,
      market: e.market,
      currency: e.currency,
      benchmark: e.benchmarkIndex,
      issuer: e.provider,
      expense_ratio_percent: e.expenseRatio,
      inception_date: e.inceptionDate,
      currency_hedged: null,
      replication_method: null,
      distribution_policy: null,
      profile_as_of: e.dataQuality?.profileAsOf ?? null,
      source_refs: e.dataQuality?.sourceRefs ?? [],
    })),
    source_catalog: snapshot.sourceCatalog ?? [],
    limitations: [
      '상품 메타데이터와 검토된 연구 후보입니다. 점수 순위를 매매 신호로 사용하지 않습니다.',
      '일별 가격·호가·과거 NAV·분배금 시계열은 별도의 검증된 시세 공급자가 담당합니다.',
    ],
  };
}

export async function publishResearch(root) {
  const snapshot = JSON.parse(await readFile(path.join(root, 'public/data/etfs.json'), 'utf8'));
  const pairs = JSON.parse(
    await readFile(path.join(root, 'scripts/data/research-pairs.json'), 'utf8'),
  );
  const catalog = buildResearch(snapshot, pairs);
  const content = JSON.stringify(catalog);
  const sha = createHash('sha256').update(content).digest('hex');
  const directory = path.join(root, 'public/data/research/v1');
  await mkdir(path.join(directory, 'snapshots'), { recursive: true });
  const file = path.join(directory, 'snapshots', `${sha}.json`);
  try {
    await writeFile(file, content, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST' || (await readFile(file, 'utf8')) !== content) throw error;
  }
  const manifest = {
    schema_version: 1,
    provider: 'eiayn',
    snapshot_id: sha,
    path: `snapshots/${sha}.json`,
    data_as_of: catalog.data_as_of,
    published_at: new Date().toISOString(),
    max_age_days: 14,
  };
  const pointer = path.join(directory, 'manifest.json');
  let previous = null;
  try {
    previous = JSON.parse(await readFile(pointer, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (previous?.snapshot_id !== sha) {
    await writeFile(`${pointer}.tmp`, JSON.stringify(manifest));
    await rename(`${pointer}.tmp`, pointer);
  }
  return { snapshot_id: sha, pairs: catalog.pairs.length, instruments: catalog.instruments.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(await publishResearch(process.cwd()));
}
