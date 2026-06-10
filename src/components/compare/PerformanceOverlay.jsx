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
        <span>{overlay ? `최근 ${overlay.window}주 · 주간 조정가격` : '1년 주간 성과 데이터'}</span>
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
        </>
      ) : (
        <p className="empty-state">
          성과 비교 차트는 1년 주간 성과 데이터가 포함된 다음 데이터 갱신부터 제공됩니다. 비교
          바구니에 데이터가 있는 ETF가 2개 이상일 때 표시됩니다.
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
      const x = PAD_X + (index / (values.length - 1)) * innerWidth;
      return `${x.toFixed(2)},${yFor(value, overlay)}`;
    })
    .join(' ');
}
