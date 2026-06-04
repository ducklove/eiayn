import { load } from 'cheerio';
import { parseCompactMoney, parsePercent } from '../../src/lib/metrics.js';
import { optionalText } from './http.mjs';

export async function fetchStockAnalysisProfile(path, currency) {
  const url = stockAnalysisUrl(path);
  const html = await optionalText(url);
  if (!html) return emptyProfile(url);

  const $ = load(html);
  const aum = parseCompactMoney(summaryValue($, 'Assets'), currency);
  return {
    source: {
      name: 'StockAnalysis profile',
      url,
      fields: ['expenseRatio', 'aum', 'dividendYield', 'inceptionDate'],
    },
    expenseRatio: parsePercent(summaryValue($, 'Expense Ratio')),
    aum: aum?.value ?? null,
    dividendYield: parsePercent(summaryValue($, 'Dividend Yield')),
    inceptionDate: parseDate(summaryValue($, 'Inception Date')),
  };
}

export async function fetchStockAnalysisHoldings(path) {
  const url = `${stockAnalysisUrl(path).replace(/\/$/, '')}/holdings/`;
  const html = await optionalText(url);
  if (!html) {
    return {
      holdings: [],
      source: { name: 'StockAnalysis holdings', url, fields: ['holdings'] },
    };
  }

  const $ = load(html);
  const rows = [];
  $('table').each((_, table) => {
    const headers = $(table).find('th').map((__, th) => cleanText($(th).text())).get();
    const nameIndex = headers.findIndex((header) => /^name$/i.test(header));
    const tickerIndex = headers.findIndex((header) => /^(symbol|ticker)$/i.test(header));
    const weightIndex = headers.findIndex((header) => /weight/i.test(header));
    if (nameIndex < 0 || weightIndex < 0) return;
    $(table).find('tbody tr').each((__, row) => {
      const cells = $(row).find('td').map((___, td) => cleanText($(td).text())).get();
      if (cells.length <= Math.max(nameIndex, weightIndex)) return;
      const weight = parsePercent(cells[weightIndex]);
      if (weight === null) return;
      rows.push({
        name: cells[nameIndex],
        ticker: tickerIndex >= 0 ? cells[tickerIndex] || null : null,
        weight,
      });
    });
  });

  return {
    holdings: rows.slice(0, 10),
    source: { name: 'StockAnalysis holdings', url, fields: ['holdings'] },
  };
}

export function stockAnalysisPathForTicker(ticker) {
  return `/etf/${String(ticker).toLowerCase()}/`;
}

function emptyProfile(url) {
  return {
    source: null,
    expenseRatio: null,
    aum: null,
    dividendYield: null,
    inceptionDate: null,
  };
}

function stockAnalysisUrl(path) {
  return `https://stockanalysis.com${path.startsWith('/') ? path : `/${path}`}`;
}

function summaryValue($, label) {
  let value = null;
  $('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cleanText(cells.eq(0).text()) === label) {
      value = cleanText(cells.eq(1).text());
    }
  });
  return value;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}
