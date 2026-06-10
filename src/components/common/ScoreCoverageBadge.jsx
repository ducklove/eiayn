export function ScoreCoverageBadge({ etf }) {
  const coverage = etf.scoreCoverage;
  if (typeof coverage !== 'number' || !Number.isFinite(coverage)) return null;
  const percent = Math.round(coverage * 100);
  const missing = Object.entries(etf.scoreBreakdown ?? {})
    .filter(([, value]) => value === null)
    .map(([label]) => label);
  const title = missing.length
    ? `데이터가 없는 팩터: ${missing.join(', ')}. 누락 팩터는 0점 처리하지 않고 점수 계산에서 제외한 뒤 남은 가중치를 재배분합니다.`
    : '모든 팩터가 실제 데이터로 계산되었습니다.';

  return (
    <span className={`coverage-badge ${percent < 80 ? 'partial' : ''}`} title={title}>
      데이터 충족도 {percent}%
    </span>
  );
}
