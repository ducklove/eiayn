import { describe, expect, it } from 'vitest';
import { formatAum, formatDateTime, formatPercent, formatPrice, scoreLabel } from './format.js';

describe('formatDateTime', () => {
  it('renders KST timestamps as YYYY-MM-DD HH:mm', () => {
    expect(formatDateTime('2026-06-05T02:32:08.842Z')).toBe('2026-06-05 11:32');
  });

  it('returns a dash for empty or invalid input', () => {
    expect(formatDateTime(null)).toBe('-');
    expect(formatDateTime('not-a-date')).toBe('-');
  });
});

describe('formatters', () => {
  it('formats prices with currency-aware decimals', () => {
    expect(formatPrice(40550, 'KRW')).toBe('₩40,550');
    expect(formatPrice(521.36, 'USD')).toBe('$521.36');
  });

  it('formats signed percents and AUM units', () => {
    expect(formatPercent(1.234)).toBe('+1.23%');
    expect(formatPercent(-0.5)).toBe('-0.50%');
    expect(formatAum(12_500_000_000, 'USD')).toBe('$12.50B');
  });

  it('labels scores and missing values', () => {
    expect(scoreLabel(85)).toBe('우수');
    expect(scoreLabel(null)).toBe('미제공');
  });
});
