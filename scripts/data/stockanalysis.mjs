import { load } from 'cheerio';
import { parseCompactMoney, toFiniteNumber } from '../../src/lib/metrics.js';
import { optionalText } from './http.mjs';
import { cleanText, emptyProfile } from './shared.mjs';

export async function fetchStockAnalysisProfile(path, currency) {
  const url = stockAnalysisUrl(path);
  const html = await optionalText(url);
  if (!html) return emptyProfile();

  const $ = load(html);
  const aum = parseCompactMoney(summaryValue($, 'Assets'), currency);
  return {
    source: {
      name: 'StockAnalysis profile',
      url,
      fields: ['expenseRatio', 'aum', 'dividendYield', 'inceptionDate'],
    },
    expenseRatio: toFiniteNumber(summaryValue($, 'Expense Ratio')),
    aum: aum?.value ?? null,
    dividendYield: toFiniteNumber(summaryValue($, 'Dividend Yield')),
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
      const weight = toFiniteNumber(cells[weightIndex]);
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

export async function fetchStockAnalysisQuoteProfile(ticker, currency) {
  const path = stockAnalysisQuotePathForTicker(ticker);
  if (!path) return emptyProfile();

  const url = stockAnalysisUrl(path);
  const html = await optionalText(url);
  if (!html) return emptyProfile();

  const $ = load(html);
  const aum = parseCompactMoney(summaryValue($, 'Assets'), currency);
  return {
    source: {
      name: 'StockAnalysis quote profile',
      url,
      fields: ['expenseRatio', 'aum', 'dividendYield', 'inceptionDate'],
    },
    expenseRatio: toFiniteNumber(summaryValue($, 'Expense Ratio')),
    aum: aum?.value ?? null,
    dividendYield: toFiniteNumber(summaryValue($, 'Dividend Yield')),
    inceptionDate: parseDate(summaryValue($, 'Inception Date')),
  };
}

export function stockAnalysisPathForTicker(ticker) {
  return `/etf/${String(ticker).toLowerCase()}/`;
}

export function stockAnalysisQuotePathForTicker(ticker) {
  const raw = String(ticker ?? '').trim().toUpperCase();
  if (!raw) return null;
  if (raw.endsWith('.HK')) {
    const code = raw.replace('.HK', '');
    return `/quote/hkg/${code.length === 5 && code.startsWith('8') ? code.slice(1) : code}/`;
  }
  if (raw.endsWith('.DE')) return `/quote/etr/${raw.replace('.DE', '')}/`;
  if (raw.endsWith('.PA')) return `/quote/epa/${raw.replace('.PA', '')}/`;
  if (raw.endsWith('.T')) return `/quote/tyo/${raw.replace('.T', '')}/`;
  if (raw.endsWith('.AX')) return `/quote/asx/${raw.replace('.AX', '')}/`;
  if (raw.endsWith('.VN')) return `/quote/hose/${raw.replace('.VN', '')}/`;
  return null;
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
  const monthMatch = String(value).trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (monthMatch) {
    const month = MONTHS[monthMatch[1].slice(0, 3).toLowerCase()];
    if (month) {
      return `${monthMatch[3]}-${month}-${monthMatch[2].padStart(2, '0')}`;
    }
  }
  const isoMatch = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0].slice(0, 10);
  const date = new Date(`${value} UTC`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

const MONTHS = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};
