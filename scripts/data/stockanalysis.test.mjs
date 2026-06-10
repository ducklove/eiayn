import { describe, expect, it } from 'vitest';
import {
  parseStockAnalysisHoldings,
  parseStockAnalysisProfile,
  stockAnalysisPathForTicker,
  stockAnalysisQuotePathForTicker,
} from './stockanalysis.mjs';

const PROFILE_URL = 'https://stockanalysis.com/etf/spy/';

function profileHtml(rows) {
  const body = rows
    .map(([label, value]) => `      <tr><td>${label}</td><td>${value}</td></tr>`)
    .join('\n');
  return `<!DOCTYPE html>
<html>
  <body>
    <main>
      <table class="sidebar-table"><tbody>
${body}
      </tbody></table>
    </main>
  </body>
</html>`;
}

function holdingsTable({ headers, rows }) {
  const head = headers.map((header) => `<th>${header}</th>`).join('');
  const body = rows
    .map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('\n');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

describe('parseStockAnalysisProfile', () => {
  const html = profileHtml([
    ['Symbol', 'SPY'],
    ['Expense Ratio', '0.09%'],
    ['Assets', '$584.21B'],
    ['Dividend Yield', '1.21%'],
    ['Inception Date', 'Jan 22, 1993'],
  ]);

  it('parses summary table values including ISO date conversion', () => {
    const profile = parseStockAnalysisProfile(html, 'USD', PROFILE_URL);
    expect(profile.expenseRatio).toBe(0.09);
    expect(profile.aum).toBe(584.21 * 1_000_000_000);
    expect(profile.dividendYield).toBe(1.21);
    expect(profile.inceptionDate).toBe('1993-01-22');
  });

  it('attaches the profile source with the fetched url', () => {
    const profile = parseStockAnalysisProfile(html, 'USD', PROFILE_URL);
    expect(profile.source).toEqual({
      name: 'StockAnalysis profile',
      url: PROFILE_URL,
      fields: ['expenseRatio', 'aum', 'dividendYield', 'inceptionDate'],
    });
  });

  it('supports an alternate source name for quote profile pages', () => {
    const profile = parseStockAnalysisProfile(
      html,
      'USD',
      PROFILE_URL,
      'StockAnalysis quote profile',
    );
    expect(profile.source.name).toBe('StockAnalysis quote profile');
    expect(profile.expenseRatio).toBe(0.09);
  });

  it('returns nulls for n/a or missing summary rows', () => {
    const sparse = profileHtml([
      ['Expense Ratio', 'n/a'],
      ['Assets', '-'],
    ]);
    const profile = parseStockAnalysisProfile(sparse, 'USD', PROFILE_URL);
    expect(profile.expenseRatio).toBeNull();
    expect(profile.aum).toBeNull();
    expect(profile.dividendYield).toBeNull();
    expect(profile.inceptionDate).toBeNull();
  });

  it('keeps ISO-formatted inception dates as-is', () => {
    const iso = profileHtml([['Inception Date', '2010-09-09']]);
    expect(parseStockAnalysisProfile(iso, 'USD', PROFILE_URL).inceptionDate).toBe('2010-09-09');
  });
});

describe('parseStockAnalysisHoldings', () => {
  it('parses Name/Symbol/%Weight tables', () => {
    const html = holdingsTable({
      headers: ['No.', 'Symbol', 'Name', '% Weight', 'Shares'],
      rows: [
        ['1', 'NVDA', 'NVIDIA Corporation', '7.95%', '8,000,000'],
        ['2', 'MSFT', 'Microsoft Corporation', '6.85%', '7,100,000'],
        ['3', 'AAPL', 'Apple Inc.', '6.21%', '14,200,000'],
      ],
    });
    expect(parseStockAnalysisHoldings(html)).toEqual([
      { name: 'NVIDIA Corporation', ticker: 'NVDA', weight: 7.95 },
      { name: 'Microsoft Corporation', ticker: 'MSFT', weight: 6.85 },
      { name: 'Apple Inc.', ticker: 'AAPL', weight: 6.21 },
    ]);
  });

  it('accepts Ticker as a header variant for Symbol', () => {
    const html = holdingsTable({
      headers: ['Ticker', 'Name', 'Weight'],
      rows: [['QQQ', 'Invesco QQQ Trust', '12.5%']],
    });
    expect(parseStockAnalysisHoldings(html)).toEqual([
      { name: 'Invesco QQQ Trust', ticker: 'QQQ', weight: 12.5 },
    ]);
  });

  it('returns null tickers when no symbol column exists', () => {
    const html = holdingsTable({
      headers: ['Name', '% Weight'],
      rows: [['Samsung Electronics', '22.1%']],
    });
    expect(parseStockAnalysisHoldings(html)).toEqual([
      { name: 'Samsung Electronics', ticker: null, weight: 22.1 },
    ]);
  });

  it('keeps rows beyond the top 10 and caps parsed holdings at 25', () => {
    const html = holdingsTable({
      headers: ['Symbol', 'Name', '% Weight'],
      rows: Array.from({ length: 30 }, (_, index) => [
        `T${index + 1}`,
        `Holding ${index + 1}`,
        `${(30 - index).toFixed(2)}%`,
      ]),
    });
    const rows = parseStockAnalysisHoldings(html);
    expect(rows).toHaveLength(25);
    expect(rows[10]).toEqual({ name: 'Holding 11', ticker: 'T11', weight: 20 });
    expect(rows.at(-1)).toEqual({ name: 'Holding 25', ticker: 'T25', weight: 6 });
  });

  it('keeps every parsed row when the page exposes fewer than 25', () => {
    const html = holdingsTable({
      headers: ['Symbol', 'Name', '% Weight'],
      rows: Array.from({ length: 12 }, (_, index) => [
        `T${index + 1}`,
        `Holding ${index + 1}`,
        `${(12 - index).toFixed(2)}%`,
      ]),
    });
    const rows = parseStockAnalysisHoldings(html);
    expect(rows).toHaveLength(12);
    expect(rows.at(-1)).toEqual({ name: 'Holding 12', ticker: 'T12', weight: 1 });
  });

  it('skips rows without a numeric weight', () => {
    const html = holdingsTable({
      headers: ['Symbol', 'Name', '% Weight'],
      rows: [
        ['AAPL', 'Apple Inc.', 'n/a'],
        ['MSFT', 'Microsoft Corporation', '6.85%'],
      ],
    });
    expect(parseStockAnalysisHoldings(html)).toEqual([
      { name: 'Microsoft Corporation', ticker: 'MSFT', weight: 6.85 },
    ]);
  });

  it('skips malformed tables and still parses valid ones', () => {
    const malformed = holdingsTable({
      headers: ['Date', 'Dividend'],
      rows: [['2026-03-20', '$1.62']],
    });
    const valid = holdingsTable({
      headers: ['Symbol', 'Name', '% Weight'],
      rows: [['VOO', 'Vanguard S&P 500 ETF', '4.10%']],
    });
    expect(parseStockAnalysisHoldings(`<div>${malformed}</div><div>${valid}</div>`)).toEqual([
      { name: 'Vanguard S&P 500 ETF', ticker: 'VOO', weight: 4.1 },
    ]);
    expect(parseStockAnalysisHoldings(malformed)).toEqual([]);
  });
});

describe('stockAnalysis paths', () => {
  it('builds lowercase ETF paths', () => {
    expect(stockAnalysisPathForTicker('SPY')).toBe('/etf/spy/');
  });

  it('maps regional suffixes to quote paths', () => {
    expect(stockAnalysisQuotePathForTicker('2800.HK')).toBe('/quote/hkg/2800/');
    expect(stockAnalysisQuotePathForTicker('A200.AX')).toBe('/quote/asx/A200/');
    expect(stockAnalysisQuotePathForTicker('SPY')).toBeNull();
  });
});
