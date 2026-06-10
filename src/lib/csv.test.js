import { describe, expect, it } from 'vitest';
import { buildCsv, csvCell } from './csv.js';

describe('csvCell', () => {
  it('passes plain values through and blanks nullish values', () => {
    expect(csvCell('KODEX 200')).toBe('KODEX 200');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes values containing commas, quotes, or newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });

  it('neutralizes formula-like string prefixes without touching numbers', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('-tagged name')).toBe("'-tagged name");
    expect(csvCell(-5.2)).toBe('-5.2');
  });
});

describe('buildCsv', () => {
  it('prefixes a UTF-8 BOM and joins header plus rows', () => {
    const csv = buildCsv([
      { name: '미국 ETF', value: 1 },
      { name: 'KODEX, 200', value: null },
    ]);

    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('name,value');
    expect(csv).toContain('미국 ETF,1');
    expect(csv).toContain('"KODEX, 200",');
  });

  it('returns null when there are no rows', () => {
    expect(buildCsv([])).toBeNull();
  });
});
