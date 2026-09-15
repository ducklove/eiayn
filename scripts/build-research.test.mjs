import { describe, expect, it } from 'vitest';
import { buildResearch } from './build-research.mjs';

const snapshot = {
  generatedAt: '2026-09-16T00:00:00Z',
  etfs: [
    { id: '069500', currency: 'KRW', benchmarkIndex: '코스피 200' },
    { id: '102110', currency: 'KRW', benchmarkIndex: '코스피 200' },
  ],
};
const pairs = [
  {
    common: '069500',
    preferred: '102110',
    expectedBenchmark: '코스피 200',
    point_in_time_verified: false,
    execution_eligible: false,
  },
];
describe('연구 상품 계약', () => {
  it('검토된 상품만 게시하고 미확인 정책은 null로 남긴다', () => {
    const r = buildResearch(snapshot, pairs);
    expect(r.pairs).toHaveLength(1);
    expect(r.instruments[0].currency_hedged).toBeNull();
    expect(r.execution_eligible).toBe(false);
  });
  it('다른 지수 또는 누락 상품으로 조용히 교체하지 않는다', () => {
    expect(() => buildResearch({ ...snapshot, etfs: snapshot.etfs.slice(1) }, pairs)).toThrow();
    expect(() =>
      buildResearch(snapshot, [{ ...pairs[0], expectedBenchmark: '다른 지수' }]),
    ).toThrow();
    expect(() => buildResearch(snapshot, [...pairs, ...pairs])).toThrow();
  });
});
