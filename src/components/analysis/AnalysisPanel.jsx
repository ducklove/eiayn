import { AlertTriangle, ChevronDown, Star } from 'lucide-react';
import {
  formatDateTime,
  formatPercent,
  formatPlainPercent,
  formatPrice,
  scoreLabel,
} from '../../lib/format.js';
import { buildHoldingChart, HOLDING_COLORS, OTHER_HOLDING_COLOR } from '../../lib/holdings.js';
import { getRiskBand } from '../../lib/search.js';
import { Radar } from '../charts/Radar.jsx';
import { ScoreCoverageBadge } from '../common/ScoreCoverageBadge.jsx';
import { RiskRow, riskMetricRows } from './riskRows.jsx';

export function AnalysisPanel({ selectedEtf, favorites, toggleFavorite }) {
  const holdings = selectedEtf.holdings ?? [];
  const holdingChart = buildHoldingChart(holdings.slice(0, 5));
  const riskRows = riskMetricRows(selectedEtf);

  return (
    <aside className="analysis-panel" id="model">
      <div className="panel-title">
        <span>선택된 ETF 분석</span>
        <button
          className="icon-button small"
          type="button"
          disabled
          title="패널 접기는 아직 지원하지 않습니다."
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <section className="selected-summary">
        <div className="summary-title">
          <div>
            <h2>{selectedEtf.name}</h2>
            <p>
              {selectedEtf.id} · {selectedEtf.market} · {selectedEtf.assetClass} ·{' '}
              {selectedEtf.category}
            </p>
          </div>
          <button
            className={`star-icon ${favorites.includes(selectedEtf.id) ? 'selected' : ''}`}
            type="button"
            onClick={() => toggleFavorite(selectedEtf.id)}
            aria-label="관심상품 토글"
          >
            <Star size={20} />
          </button>
        </div>
        <div className="quote-line">
          <div>
            <span>현재가</span>
            <strong>{formatPrice(selectedEtf.price, selectedEtf.currency)}</strong>
          </div>
          <em className={selectedEtf.changePercent >= 0 ? 'positive' : 'negative'}>
            {formatPercent(selectedEtf.changePercent)} ({selectedEtf.changePercent >= 0 ? '▲' : '▼'}
            )
          </em>
        </div>
        <p className="asof-note">
          시세 기준: {formatDateTime(selectedEtf.dataQuality.quoteAsOf)} KST
        </p>
      </section>

      <section className="score-card">
        <div className="score-main">
          <span>AIYN 점수</span>
          <strong>
            {selectedEtf.aiynScore ?? '-'}
            <small>/100</small>
          </strong>
          <b>{scoreLabel(selectedEtf.aiynScore)}</b>
          <ScoreCoverageBadge etf={selectedEtf} />
        </div>
        <Radar factors={selectedEtf.scoreBreakdown ?? {}} />
      </section>

      <section className="portfolio-block" id="holdings">
        <div className="section-heading">
          <h3>포트폴리오 구성 (상위 5)</h3>
          <button type="button" disabled title="전체 보유종목 표는 아직 제공하지 않습니다.">
            더보기
          </button>
        </div>
        {holdings.length ? (
          <div className="portfolio-body">
            <div
              className="donut"
              style={{ '--donut': holdingChart.stops.join(', ') }}
              aria-label="구성종목 비중 도넛 차트"
            />
            <div className="holding-list">
              {holdings.slice(0, 5).map((holding, index) => (
                <div className="holding-row" key={`${holding.ticker}-${holding.name}`}>
                  <span style={{ '--dot-color': HOLDING_COLORS[index % HOLDING_COLORS.length] }} />
                  <strong>{holding.name}</strong>
                  <em>{formatPlainPercent(holding.weight)}</em>
                </div>
              ))}
              <div className="holding-row muted">
                <span style={{ '--dot-color': OTHER_HOLDING_COLOR }} />
                <strong>기타</strong>
                <em>{formatPlainPercent(holdingChart.otherWeight)}</em>
              </div>
            </div>
          </div>
        ) : (
          <p className="empty-state">보유종목 데이터 없음</p>
        )}
      </section>

      {riskRows.length ? (
        <section className="risk-block">
          <h3>위험 지표</h3>
          <dl>
            {riskRows.map((row, index) => (
              <RiskRow
                key={row.label}
                label={row.label}
                value={row.value}
                tag={index === 0 ? getRiskBand(selectedEtf) : undefined}
              />
            ))}
          </dl>
        </section>
      ) : null}

      <section className="risk-note" id="risk">
        <AlertTriangle size={18} />
        <div>
          <h3>투자 유의 고지</h3>
          <p>본 화면은 공개 데이터 스냅샷을 정리한 정보 제공용 도구이며 투자 조언이 아닙니다.</p>
          <p>
            가격·환율·보유종목은 출처 갱신 시점과 지연에 따라 실제 거래 정보와 차이가 날 수
            있습니다.
          </p>
          <p>투자 판단의 최종 책임은 투자자 본인에게 있습니다.</p>
        </div>
      </section>
    </aside>
  );
}
