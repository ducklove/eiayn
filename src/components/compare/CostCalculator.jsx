import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { estimateHoldingCost } from '../../lib/cost.js';
import { formatPlainPercent } from '../../lib/format.js';

const AMOUNT_FORMAT = new Intl.NumberFormat('ko-KR');

export function CostCalculator({ selectedEtfs }) {
  const [amount, setAmount] = useState(10_000_000);
  const [years, setYears] = useState(5);

  const rows = selectedEtfs.map((etf) => ({
    etf,
    cost: estimateHoldingCost({ amount, years, expenseRatio: etf.expenseRatio }),
  }));

  return (
    <section className="cost-calculator" aria-labelledby="cost-calculator-title">
      <div className="section-heading">
        <div className="heading-title">
          <Calculator size={16} />
          <h3 id="cost-calculator-title">총보수 비용 계산기</h3>
        </div>
        <span>수익률·복리·환율을 반영하지 않은 단순 추정입니다.</span>
      </div>
      <div className="cost-inputs">
        <label>
          투자금액
          <input
            type="number"
            min="0"
            step="1000000"
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </label>
        <label>
          보유기간 (년)
          <input
            type="number"
            min="1"
            max="50"
            step="1"
            value={years}
            onChange={(event) => setYears(Number(event.target.value))}
          />
        </label>
        <p className="cost-summary">
          {AMOUNT_FORMAT.format(amount || 0)}을 {years || 0}년 보유할 때 ETF별 총보수 부담:
        </p>
      </div>
      <div className="cost-rows">
        {rows.map(({ etf, cost }) => (
          <div className="cost-row" key={etf.id}>
            <strong>{etf.shortName}</strong>
            <span>총보수 {formatPlainPercent(etf.expenseRatio)}</span>
            {cost ? (
              <>
                <em>연 {AMOUNT_FORMAT.format(Math.round(cost.annual))}</em>
                <b>
                  {years}년 누적 {AMOUNT_FORMAT.format(Math.round(cost.total))}
                </b>
              </>
            ) : (
              <em className="cost-missing">총보수 데이터 없음</em>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
