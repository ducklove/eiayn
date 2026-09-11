import { describe, it, expect } from 'vitest';
import { buildCatalog } from './build-catalog.mjs';
import { filterEtfs } from '../src/lib/search.js';

const etf = {
  id: 'A',
  name: '배당 ETF',
  shortName: '배당 ETF',
  holdings: [{ name: '삼성전자', ticker: '005930', weight: 12 }],
  sparkline: [10, 20],
  performance1y: { dates: ['2026-01-02', '2026-01-09'], values: [100, 110] },
  dataQuality: { sourceRefs: [0], quoteAsOf: null },
};
describe('탐색 목록과 상세 자료 분리', () => {
  it('검색 결과를 유지하면서 무거운 시계열과 비중을 상세로 옮긴다', () => {
    const snapshot = { generatedAt: '2026-09-11', etfs: [etf] };
    const { catalog, files } = buildCatalog(snapshot);
    const row = catalog.etfs[0];
    expect(row.sparkline).toBeUndefined();
    expect(row.performance1y).toBeUndefined();
    expect(row.holdings).toBeUndefined();
    const searchable = {
      ...row,
      holdings: row.searchHoldings.map(([name, ticker]) => ({ name, ticker })),
    };
    expect(filterEtfs([searchable], '삼성 전자').map((x) => x.id)).toEqual(
      filterEtfs([etf], '삼성 전자').map((x) => x.id),
    );
    expect(files.get(row.detailFile).holdings[0].weight).toBe(12);
    expect(files.get(row.detailFile).snapshotVersion).toBe(catalog.snapshotVersion);
  });
  it('같은 자료는 같은 주소, 갱신된 자료는 다른 주소를 만든다', () => {
    const first = buildCatalog({ etfs: [etf] });
    expect(buildCatalog({ etfs: [etf] }).catalog).toEqual(first.catalog);
    expect(buildCatalog({ etfs: [{ ...etf, price: 10 }] }).catalog.etfs[0].detailFile).not.toBe(
      first.catalog.etfs[0].detailFile,
    );
  });
});
