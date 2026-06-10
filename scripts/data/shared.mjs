export function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function emptyProfile() {
  return {
    source: null,
    expenseRatio: null,
    aum: null,
    dividendYield: null,
    inceptionDate: null,
  };
}
