import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function buildCatalog(snapshot) {
  const snapshotVersion = createHash('sha256')
    .update(JSON.stringify(snapshot))
    .digest('hex')
    .slice(0, 24);
  const files = new Map();
  const etfs = snapshot.etfs.map((etf) => {
    const { holdings, sparkline, performance1y, liquidity, dataQuality, ...metadata } = etf;
    const filename = `${createHash('sha256').update(`${snapshotVersion}:${etf.id}`).digest('hex').slice(0, 24)}.json`;
    files.set(filename, {
      snapshotVersion,
      id: etf.id,
      holdings,
      sparkline,
      performance1y,
      liquidity,
      dataQuality,
    });
    const { sourceRefs, sources, ...quality } = dataQuality;
    void sourceRefs;
    void sources;
    return {
      ...metadata,
      dataQuality: quality,
      searchHoldings: holdings.map(({ name, ticker }) => [name, ticker]),
      detailFile: filename,
    };
  });
  return {
    catalog: {
      schemaVersion: 1,
      snapshotVersion,
      generatedAt: snapshot.generatedAt,
      scoreModelVersion: snapshot.scoreModelVersion,
      exchangeRates: snapshot.exchangeRates,
      etfs,
    },
    files,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd();
  const directory = path.resolve(root, 'public', 'runtime-data');
  const snapshot = JSON.parse(await readFile(path.join(root, 'public/data/etfs.json'), 'utf8'));
  const { catalog, files } = buildCatalog(snapshot);
  await mkdir(directory, { recursive: true });
  // 이 생성 폴더의 해시 파일만 정리하며 원천 자료와 다른 파일에는 접근하지 않습니다.
  for (const filename of await readdir(directory)) {
    if (/^[a-f0-9]{24}\.json$/.test(filename) && !files.has(filename))
      await unlink(path.join(directory, filename));
  }
  const entries = [...files];
  for (let start = 0; start < entries.length; start += 64) {
    await Promise.all(
      entries
        .slice(start, start + 64)
        .map(([filename, payload]) =>
          writeFile(path.join(directory, filename), JSON.stringify(payload), 'utf8'),
        ),
    );
  }
  const json = JSON.stringify(catalog);
  await writeFile(path.join(directory, 'catalog.json'), json, 'utf8');
  console.log(
    `[build-catalog] ${catalog.etfs.length} ETFs, catalog ${Buffer.byteLength(json)} bytes, ${files.size} detail files`,
  );
}
