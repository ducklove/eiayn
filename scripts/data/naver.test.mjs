import { describe, expect, it } from 'vitest';
import {
  classifyKoreanAssetClass,
  classifyKoreanTheme,
  koreanCategory,
  naverAnalysisUrl,
  NAVER_SOURCES,
  normalizeIssuerName,
  normalizeNaverHoldings,
  parseDeviation,
  parseNaverListedDate,
  parseNaverReferenceDate,
  periodReturn,
} from './naver.mjs';

const URL = naverAnalysisUrl('069500');

describe('naverAnalysisUrl', () => {
  it('substitutes the code into the template', () => {
    expect(URL).toBe('https://m.stock.naver.com/api/stock/069500/etfAnalysis');
  });
});

describe('parseNaverListedDate', () => {
  it('formats YYYYMMDD as YYYY-MM-DD', () => {
    expect(parseNaverListedDate('20021014')).toBe('2002-10-14');
  });

  it('returns null for missing or malformed values', () => {
    expect(parseNaverListedDate(null)).toBeNull();
    expect(parseNaverListedDate('2002-10-14')).toBeNull();
    expect(parseNaverListedDate('2002101')).toBeNull();
  });
});

describe('parseNaverReferenceDate', () => {
  it('formats dotted reference dates', () => {
    expect(parseNaverReferenceDate('2026.07.21')).toBe('2026-07-21');
  });

  it('returns null otherwise', () => {
    expect(parseNaverReferenceDate('2026-07-21')).toBeNull();
    expect(parseNaverReferenceDate(undefined)).toBeNull();
  });
});

describe('normalizeIssuerName', () => {
  it('strips the (ETF) suffix Naver appends', () => {
    expect(normalizeIssuerName('삼성자산운용(ETF)')).toBe('삼성자산운용');
    expect(normalizeIssuerName('미래에셋자산운용')).toBe('미래에셋자산운용');
  });

  it('returns null for empty values', () => {
    expect(normalizeIssuerName('')).toBeNull();
    expect(normalizeIssuerName(null)).toBeNull();
  });
});

describe('parseDeviation', () => {
  it('applies the sign to the magnitude', () => {
    expect(parseDeviation({ deviationSign: '+', deviationRate: 0.27 })).toBe(0.27);
    expect(parseDeviation({ deviationSign: '-', deviationRate: 0.49 })).toBe(-0.49);
  });

  it('returns null for missing or implausible magnitudes', () => {
    expect(parseDeviation({})).toBeNull();
    expect(parseDeviation(null)).toBeNull();
    expect(parseDeviation({ deviationSign: '+', deviationRate: 51 })).toBeNull();
  });
});

describe('periodReturn', () => {
  const analysis = {
    returnPerformanceList: [
      { periodTypeCode: 'M3', value: 12.07 },
      { periodTypeCode: 'Y1', value: '150.5' },
      { periodTypeCode: 'Y3', value: null },
    ],
  };

  it('reads the requested period as a number', () => {
    expect(periodReturn(analysis, 'M3')).toBe(12.07);
    expect(periodReturn(analysis, 'Y1')).toBe(150.5);
  });

  it('returns null for missing periods and missing lists', () => {
    expect(periodReturn(analysis, 'Y3')).toBeNull();
    expect(periodReturn(analysis, 'Y10')).toBeNull();
    expect(periodReturn(null, 'M3')).toBeNull();
  });
});

describe('normalizeNaverHoldings', () => {
  it('parses percent weights and keeps the ticker when present', () => {
    const result = normalizeNaverHoldings(
      {
        etfTop10MajorConstituentAssets: [
          { itemCode: '005930', itemName: ' 삼성전자 ', etfWeight: '32.76%' },
          { itemCode: '', itemName: '원화현금', etfWeight: '1.5%' },
        ],
      },
      URL,
    );
    expect(result.holdings).toEqual([
      { name: '삼성전자', ticker: '005930', weight: 32.76 },
      { name: '원화현금', ticker: null, weight: 1.5 },
    ]);
    expect(result.source).toEqual({
      name: NAVER_SOURCES.analysis.name,
      url: URL,
      fields: ['holdings'],
    });
  });

  it('keeps weightless rows with weight null and drops nameless rows', () => {
    const result = normalizeNaverHoldings(
      {
        etfTop10MajorConstituentAssets: [
          { itemCode: '', itemName: 'FORD MOTOR CO', etfWeight: '-' },
          { itemCode: '', itemName: '', etfWeight: '10%' },
        ],
      },
      URL,
    );
    expect(result.holdings).toEqual([{ name: 'FORD MOTOR CO', ticker: null, weight: null }]);
    expect(result.source).not.toBeNull();
  });

  it('tolerates a missing analysis', () => {
    expect(normalizeNaverHoldings(null, URL)).toEqual({ holdings: [], source: null });
  });
});

describe('classifyKoreanAssetClass', () => {
  it('classifies bonds by tab code or keywords', () => {
    expect(classifyKoreanAssetClass({ name: 'KIWOOM 국고채10년', tabCode: 6 })).toBe('채권');
    expect(classifyKoreanAssetClass({ name: 'RISE 종합채권(A-이상)액티브' })).toBe('채권');
    expect(classifyKoreanAssetClass({ name: 'KODEX KOFR금리액티브(합성)' })).toBe('채권');
  });

  it('classifies commodities, mixed-asset, and currency listings', () => {
    expect(classifyKoreanAssetClass({ name: 'KODEX 골드선물(H)' })).toBe('원자재');
    expect(classifyKoreanAssetClass({ name: 'ACE KRX금현물', tabCode: 5 })).toBe('원자재');
    expect(classifyKoreanAssetClass({ name: 'KODEX 200미국채혼합50' })).toBe('혼합자산');
    expect(classifyKoreanAssetClass({ name: '삼성 TDF2045액티브' })).toBe('혼합자산');
    expect(classifyKoreanAssetClass({ name: 'KODEX 미국달러선물' })).toBe('ETF');
  });

  it('defaults to equities', () => {
    expect(classifyKoreanAssetClass({ name: 'KODEX 200', baseIndex: '코스피 200' })).toBe('주식');
  });
});

describe('classifyKoreanTheme', () => {
  it('always labels bond asset class as 채권', () => {
    expect(classifyKoreanTheme({ name: 'KIWOOM 국고채10년', assetClass: '채권' })).toBe('채권');
  });

  it('matches the name before the base index, in rule order', () => {
    expect(
      classifyKoreanTheme({ name: 'KODEX 200타겟위클리커버드콜', baseIndex: '코스피 200 지수' }),
    ).toBe('커버드콜');
    expect(classifyKoreanTheme({ name: 'TIGER 미국배당다우존스' })).toBe('배당');
    expect(classifyKoreanTheme({ name: 'KODEX 레버리지', baseIndex: '코스피 200' })).toBe(
      '레버리지',
    );
  });

  it('falls back to the base index, then the Naver theme label', () => {
    expect(classifyKoreanTheme({ name: 'KODEX 200', baseIndex: '코스피 200' })).toBe('시장대표');
    expect(classifyKoreanTheme({ name: 'ACE 포스코그룹포커스', themeMiddle: '그룹주' })).toBe(
      '그룹주',
    );
    expect(classifyKoreanTheme({ name: 'UNKNOWN' })).toBe('기타');
  });
});

describe('koreanCategory', () => {
  it('joins asset class and theme, deduplicating identical labels', () => {
    expect(koreanCategory({ assetClass: '주식', theme: '시장대표' })).toBe('주식-시장대표');
    expect(koreanCategory({ assetClass: '채권', theme: '채권' })).toBe('채권');
  });
});
