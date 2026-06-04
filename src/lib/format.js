export function formatPrice(value, currency) {
  if (!isNumber(value)) return '-';
  return new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(value);
}

export function formatPercent(value, digits = 2) {
  if (!isNumber(value)) return '-';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

export function formatPlainPercent(value, digits = 2) {
  if (!isNumber(value)) return '-';
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value, digits = 2) {
  if (!isNumber(value)) return '-';
  return value.toFixed(digits);
}

export function formatAum(value, currency) {
  if (!isNumber(value)) return '-';
  const unit = currency === 'KRW'
    ? [
        [1_000_000_000_000, '조'],
        [100_000_000, '억'],
      ]
    : [
        [1_000_000_000_000, 'T'],
        [1_000_000_000, 'B'],
        [1_000_000, 'M'],
      ];

  const [divisor, suffix] = unit.find(([candidate]) => value >= candidate) ?? [1, ''];
  const formatted = new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: divisor === 1 ? 0 : 2,
  }).format(value / divisor);

  return currency === 'KRW' ? `₩${formatted}${suffix}` : `$${formatted}${suffix}`;
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\\. /g, '-').replace('.', '');
}

export function scoreLabel(score) {
  if (!isNumber(score)) return '미제공';
  if (score >= 80) return '우수';
  if (score >= 70) return '양호';
  if (score >= 60) return '보통';
  return '주의';
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
