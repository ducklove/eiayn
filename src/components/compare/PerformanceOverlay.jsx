import { buildOverlaySeries } from '../../lib/overlay.js';
import { formatPercent, returnTone } from '../../lib/format.js';
import { HOLDING_COLORS } from '../../lib/holdings.js';

const WIDTH = 100;
const HEIGHT = 48;
const PAD_X = 4;
const PAD_TOP = 6;
const PAD_BOTTOM = 6;

export function PerformanceOverlay({ selectedEtfs }) {
  const overlay = buildOverlaySeries(selectedEtfs);

  return (
    <section className="performance-overlay" aria-labelledby="overlay-title">
      <div className="section-heading">
        <h3 id="overlay-title">성과 비교 (시작점 100 기준)</h3>
        <span>
          {overlay
            ? `${overlay.start} ~ ${overlay.end} · 공통 관측일 ${overlay.window}개`
            : '실제 관측일 기준 성과 비교'}
        </span>
      </div>
      {overlay ? (
        <>
          <svg
            className="overlay-chart"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label="비교 ETF 정규화 성과 곡선"
          >
            <line
              className="overlay-baseline"
              x1={PAD_X}
              y1={yFor(100, overlay)}
              x2={WIDTH - PAD_X}
              y2={yFor(100, overlay)}
            />
            {overlay.series.map((item, index) => (
              <polyline
                key={item.id}
                points={pointsFor(item.values, overlay)}
                style={{ stroke: HOLDING_COLORS[index % HOLDING_COLORS.length] }}
              />
            ))}
          </svg>
          <div className="overlay-legend">
            {overlay.series.map((item, index) => (
              <span className="overlay-legend-item" key={item.id}>
                <i style={{ background: HOLDING_COLORS[index % HOLDING_COLORS.length] }} />
                {item.label}
                <b className={returnTone(item.changePercent) ?? ''}>
                  {formatPercent(item.changePercent)}
                </b>
              </span>
            ))}
          </div>
          <p className="empty-state">
            각 시장 현지 통화의 조정가격 기준입니다. 환율 수익은 포함하지 않습니다.
            {overlay.excluded.length > 0
              ? ` 관측일 자료가 없어 제외: ${overlay.excluded.join(', ')}`
              : ''}
          </p>
        </>
      ) : (
        <p className="empty-state">
          실제 관측일이 겹치는 데이터가 2개 이상인 ETF를 선택해 주세요. 날짜가 없는 과거 자료나 공통
          관측일이 부족한 자료로는 비교 수익률을 계산하지 않습니다.
        </p>
      )}
    </section>
  );
}

function yFor(value, overlay) {
  const spread = overlay.max - overlay.min || 1;
  const usable = HEIGHT - PAD_TOP - PAD_BOTTOM;
  return (HEIGHT - PAD_BOTTOM - ((value - overlay.min) / spread) * usable).toFixed(2);
}

function pointsFor(values, overlay) {
  const innerWidth = WIDTH - PAD_X * 2;
  return values
    .map((value, index) => {
      const elapsed = Date.parse(overlay.dates[index]) - Date.parse(overlay.start);
      const duration = Date.parse(overlay.end) - Date.parse(overlay.start);
      const x = PAD_X + (elapsed / duration) * innerWidth;
      return `${x.toFixed(2)},${yFor(value, overlay)}`;
    })
    .join(' ');
}
