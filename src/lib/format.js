export function formatPrice(value, currency) {
  if (!isNumber(value)) return '-';
  return new Intl.NumberFormat(localeForCurrency(currency), {
    style: 'currency',
    currency: currency ?? 'USD',
    maximumFractionDigits: zeroDecimalCurrency(currency) ? 0 : 2,
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
  const unit = [
    [1_000_000_000_000, 'T'],
    [1_000_000_000, 'B'],
    [1_000_000, 'M'],
  ];

  const [divisor, suffix] = unit.find(([candidate]) => value >= candidate) ?? [1, ''];
  const formatted = new Intl.NumberFormat(localeForCurrency(currency), {
    style: 'currency',
    currency: currency ?? 'USD',
    maximumFractionDigits: divisor === 1 || zeroDecimalCurrency(currency) ? 0 : 2,
  }).format(value / divisor);

  return `${formatted}${suffix}`;
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const parts = {};
  for (const part of new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
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

function localeForCurrency(currency) {
  return ({
    KRW: 'ko-KR',
    USD: 'en-US',
    HKD: 'en-HK',
    EUR: 'de-DE',
    JPY: 'ja-JP',
    AUD: 'en-AU',
    VND: 'vi-VN',
  })[currency] ?? 'en-US';
}

export function zeroDecimalCurrency(currency) {
  return ['KRW', 'JPY', 'VND'].includes(currency);
}
