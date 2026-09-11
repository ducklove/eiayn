import { formatDateTime } from '../../lib/format.js';

export function QuoteTime({ quality = {} }) {
  return (
    <span className="quote-time">
      <span>
        시세 기준:{' '}
        {quality.quoteAsOf ? `${formatDateTime(quality.quoteAsOf)} KST` : '원천 거래 시각 미확인'}
      </span>
      {quality.quoteCollectedAt && (
        <span>수집: {formatDateTime(quality.quoteCollectedAt)} KST</span>
      )}
    </span>
  );
}
