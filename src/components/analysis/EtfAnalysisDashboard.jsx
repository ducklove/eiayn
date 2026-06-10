import { AlertTriangle, Star } from 'lucide-react';
import {
  formatAum,
  formatDateTime,
  formatPercent,
  formatPlainPercent,
  formatPrice,
  returnTone,
  scoreLabel,
} from '../../lib/format.js';
import { buildHoldingChart, HOLDING_COLORS, OTHER_HOLDING_COLOR } from '../../lib/holdings.js';
import { getRiskBand } from '../../lib/search.js';
import { Radar } from '../charts/Radar.jsx';
import { DetailedSparkline } from '../charts/DetailedSparkline.jsx';
import { MetricTile } from '../common/MetricTile.jsx';
import { InfoPopover } from '../common/InfoPopover.jsx';
import { RiskRow, riskMetricRows } from './riskRows.jsx';

const FACTOR_DESCRIPTIONS = {
  '단기 수익': '최근 30일 가격 변화와 3개월 수익률을 ETF 유니버스 안의 백분위로 비교합니다. 두 기간을 같은 비중으로 반영합니다.',
  '장기 수익': '1년, 3년·5년 연환산 수익률을 ETF 유니버스 안의 백분위로 비교합니다. 1년 수익률 비중이 가장 큽니다.',
  가치: '총보수 점수와 순자산(AUM) 규모 점수를 합친 항목입니다. 비용이 낮고 규모가 클수록 높게 잡힙니다.',
  안정성: '3년 샤프지수, 3년 연환산 변동성, 3년 최대낙폭을 함께 봅니다. 변동성과 낙폭은 낮을수록 유리합니다.',
  분산: '상위 10개 보유종목의 집중도가 낮을수록 높은 점수를 받습니다. 보유종목 데이터가 없으면 이 팩터는 점수 계산에서 제외됩니다.',
  효율성: '낮은 총보수와 추적 안정성(추적오차·정보비율)을 함께 반영합니다. 추적 데이터가 없으면 총보수 중심으로 계산됩니다.',
};

export function EtfAnalysisDashboard({ selectedEtf, favorites, toggleFavorite }) {
  const holdings = selectedEtf.holdings ?? [];
  const topHoldings = holdings.slice(0, 10);
  const holdingChart = buildHoldingChart(topHoldings);
  const factorEntries = Object.entries(selectedEtf.scoreBreakdown ?? {}).filter(([label, value]) => label !== '총보수' && typeof value === 'number');
  const riskRows = riskMetricRows(selectedEtf);
  const m3Tone = returnTone(selectedEtf.returns.m3);
  const y1Tone = returnTone(selectedEtf.returns.y1);
  const y3Tone = returnTone(selectedEtf.returns.y3Annualized);
  const y5Tone = returnTone(selectedEtf.returns.y5Annualized);

  return (
    <section className="single-etf-dashboard" id="model" aria-labelledby="single-analysis-title">
      <div className="single-hero">
        <div className="single-identity">
          <div className="eyebrow-line">
            <span>{selectedEtf.market}</span>
            <span>{selectedEtf.assetClass}</span>
            <span>{selectedEtf.category}</span>
          </div>
          <h2 id="single-analysis-title">{selectedEtf.name}</h2>
          <p>{selectedEtf.id} · {selectedEtf.provider ?? '운용사 데이터 없음'} · {selectedEtf.benchmarkIndex ?? '기초지수 데이터 없음'}</p>
          <div className="quote-strip">
            <div>
              <span>현재가</span>
              <strong>{formatPrice(selectedEtf.price, selectedEtf.currency)}</strong>
            </div>
            <em className={selectedEtf.changePercent >= 0 ? 'positive' : 'negative'}>
              {formatPercent(selectedEtf.changePercent)} {selectedEtf.changePercent >= 0 ? '▲' : '▼'}
            </em>
            <small>시세 기준: {formatDateTime(selectedEtf.dataQuality.quoteAsOf)} KST</small>
          </div>
        </div>

        <div className="single-score-panel">
          <div className="score-main">
            <span>AIYN 점수</span>
            <strong>{selectedEtf.aiynScore ?? '-'}<small>/100</small></strong>
            <b>{scoreLabel(selectedEtf.aiynScore)}</b>
          </div>
          <Radar factors={selectedEtf.scoreBreakdown ?? {}} />
        </div>
      </div>

      <div className="metric-tile-grid">
        <MetricTile label="총보수 (연)" value={formatPlainPercent(selectedEtf.expenseRatio)} tone="cost" />
        <MetricTile label="순자산 (AUM)" value={formatAum(selectedEtf.aum, selectedEtf.currency)} />
        <MetricTile label="배당수익률 (연)" value={formatPlainPercent(selectedEtf.dividendYield)} />
        <MetricTile label="상장일" value={selectedEtf.inceptionDate ?? '-'} />
        <MetricTile label="3개월 수익률" value={formatPercent(selectedEtf.returns.m3)} tone={m3Tone} />
        <MetricTile label="1년 수익률" value={formatPercent(selectedEtf.returns.y1)} tone={y1Tone} />
        <MetricTile label="3년 연환산" value={formatPercent(selectedEtf.returns.y3Annualized)} tone={y3Tone} />
        <MetricTile label="5년 연환산" value={formatPercent(selectedEtf.returns.y5Annualized)} tone={y5Tone} />
      </div>

      <div className="analysis-main-grid">
        <section className="analysis-card performance-card">
          <div className="section-heading">
            <h3>성과 흐름</h3>
            <span>최근 30일 · 조정가격 기반</span>
          </div>
          <DetailedSparkline values={selectedEtf.sparkline} currency={selectedEtf.currency} />
          <div className="return-grid">
            <MetricTile label="3개월" value={formatPercent(selectedEtf.returns.m3)} tone={m3Tone} />
            <MetricTile label="1년" value={formatPercent(selectedEtf.returns.y1)} tone={y1Tone} />
            <MetricTile label="3년" value={formatPercent(selectedEtf.returns.y3Annualized)} tone={y3Tone} />
            <MetricTile label="5년" value={formatPercent(selectedEtf.returns.y5Annualized)} tone={y5Tone} />
          </div>
        </section>

        <section className="analysis-card factor-card">
          <div className="section-heading">
            <div className="heading-title">
              <h3>AIYN 팩터</h3>
              <InfoPopover title="AIYN 팩터란?">
                <p>AIYN 점수는 비용, 규모, 단기 수익, 장기 수익, 위험조정, 추종 안정성, 분산도를 0-100으로 정규화한 뒤 데이터가 있는 항목끼리 가중 평균합니다.</p>
                <p>데이터가 없는 팩터는 0점 처리하지 않고 계산에서 제외한 뒤 남은 가중치를 재배분합니다.</p>
              </InfoPopover>
            </div>
            <span>0-100 정규화</span>
          </div>
          <div className="factor-list">
            {factorEntries.map(([label, value]) => (
              <details className="factor-row" key={label}>
                <summary>
                  <span>{label}</span>
                  <div className="factor-bar" aria-hidden="true"><i style={{ width: `${value}%` }} /></div>
                  <strong>{value}</strong>
                </summary>
                <p>{FACTOR_DESCRIPTIONS[label] ?? '해당 팩터는 수집된 실제 지표를 전체 ETF 유니버스 기준으로 정규화한 값입니다.'}</p>
              </details>
            ))}
          </div>
        </section>

        {riskRows.length ? (
          <section className="analysis-card">
            <div className="section-heading">
              <h3>위험 지표</h3>
              <span>{getRiskBand(selectedEtf)}</span>
            </div>
            <dl className="detail-list">
              {riskRows.map((row) => <RiskRow key={row.label} label={row.label} value={row.value} />)}
            </dl>
          </section>
        ) : null}

        <section className="analysis-card holdings-card" id="holdings">
          <div className="section-heading">
            <h3>포트폴리오 구성</h3>
            <span>상위 {Math.min(topHoldings.length, 10)}개</span>
          </div>
          {topHoldings.length ? (
            <div className="portfolio-wide-layout">
              <div className="donut large" style={{ '--donut': holdingChart.stops.join(', ') }} aria-label="상위 보유종목 비중 도넛 차트" />
              <div className="wide-holdings">
                {topHoldings.map((holding, index) => (
                  <div className="wide-holding-row" key={`${holding.ticker}-${holding.name}-${index}`}>
                    <span style={{ '--dot-color': HOLDING_COLORS[index % HOLDING_COLORS.length] }}>{index + 1}</span>
                    <strong>{holding.name}</strong>
                    <em>{holding.ticker ?? '-'}</em>
                    <b>{formatPlainPercent(holding.weight)}</b>
                  </div>
                ))}
                <div className="wide-holding-row muted">
                  <span style={{ '--dot-color': OTHER_HOLDING_COLOR }} />
                  <strong>기타</strong>
                  <em />
                  <b>{formatPlainPercent(holdingChart.otherWeight)}</b>
                </div>
              </div>
            </div>
          ) : <p className="empty-state">보유종목 데이터 없음</p>}
        </section>

        <section className="analysis-card risk-note single-risk-note" id="risk">
          <AlertTriangle size={18} />
          <div>
            <h3>투자 유의 고지</h3>
            <p>본 화면은 공개 데이터 스냅샷을 정리한 정보 제공용 도구이며 투자 조언이 아닙니다.</p>
            <p>가격·환율·보유종목은 출처 갱신 시점과 지연에 따라 실제 거래 정보와 차이가 날 수 있습니다.</p>
            <p>투자 판단의 최종 책임은 투자자 본인에게 있습니다.</p>
          </div>
        </section>
      </div>

      <button className={`floating-favorite ${favorites.includes(selectedEtf.id) ? 'selected' : ''}`} type="button" onClick={() => toggleFavorite(selectedEtf.id)}>
        <Star size={16} />
        관심상품
      </button>
    </section>
  );
}
