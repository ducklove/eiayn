import { TrendingUp } from 'lucide-react';
import { useDataFile } from '../../hooks/useDataFile.js';
import { extractScoreSeries } from '../../lib/history.js';
import { returnTone } from '../../lib/format.js';

export function ScoreTrend({ etfId }) {
  const { data: history, loading } = useDataFile('history.json');
  const series = extractScoreSeries(history, etfId);

  return (
    <section className="analysis-card score-trend" aria-labelledby="score-trend-title">
      <div className="section-heading">
        <div className="heading-title">
          <TrendingUp size={16} />
          <h3 id="score-trend-title">AIYN 점수 추이</h3>
        </div>
        <span>일별 스냅샷 기준</span>
      </div>
      {loading ? (
        <p className="empty-state">점수 이력을 불러오는 중입니다.</p>
      ) : series.length >= 2 ? (
        <TrendChart series={series} />
      ) : (
        <p className="empty-state">
          점수 추이는 일별 데이터가 누적되면 표시됩니다.
          {series.length === 1 ? ` (현재 1일: ${series[0].date}, ${series[0].score}점)` : ''}
        </p>
      )}
    </section>
  );
}

function TrendChart({ series }) {
  const scores = series.map((point) => point.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const spread = max - min || 1;
  const first = series[0];
  const last = series.at(-1);
  const delta = last.score - first.score;

  const points = series
    .map((point, index) => {
      const x = 4 + (index / (series.length - 1)) * 92;
      const y = 40 - ((point.score - min) / spread) * 30;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div className="score-trend-body">
      <svg className="score-trend-chart" viewBox="0 0 100 46" role="img" aria-label="점수 추이">
        <polyline points={points} />
      </svg>
      <div className="score-trend-stats">
        <span>
          {first.date} <b>{first.score}점</b>
        </span>
        <span>
          {last.date} <b>{last.score}점</b>
        </span>
        <em className={returnTone(delta) ?? ''}>
          {delta > 0 ? '+' : ''}
          {delta}점 ({series.length}일)
        </em>
      </div>
    </div>
  );
}
