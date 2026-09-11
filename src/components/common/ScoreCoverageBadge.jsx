export function ScoreCoverageBadge({ etf }) {
  const coverage = etf.scoreCoverage;
  if (typeof coverage !== 'number' || !Number.isFinite(coverage)) return null;
  const percent = Math.round(coverage * 100);
  const labels = {
    cost: '비용',
    scale: '규모',
    shortReturn: '단기 수익',
    longReturn: '장기 수익',
    riskAdjusted: '위험조정',
    tracking: '추종 안정성',
    diversification: '분산',
  };
  const missing = Object.entries(etf.scoreComponents ?? etf.scoreBreakdown ?? {})
    .filter(([, value]) => value === null)
    .map(([label]) => labels[label] ?? label);
  const title = missing.length
    ? `데이터가 없는 팩터: ${missing.join(', ')}. 누락 팩터는 0점 처리하지 않고 점수 계산에서 제외한 뒤 남은 가중치를 재배분합니다.`
    : percent < 100
      ? '점수 계산에 필요한 일부 데이터가 없습니다. 제공된 항목의 가중치를 재배분한 점수입니다.'
      : '모든 팩터가 실제 데이터로 계산되었습니다. 각 팩터 안의 세부 지표는 일부 누락될 수 있습니다.';

  return (
    <span className={`coverage-badge ${percent < 80 ? 'partial' : ''}`} title={title}>
      데이터 충족도 {percent}%
    </span>
  );
}
