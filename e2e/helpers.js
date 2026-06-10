import { expect } from 'playwright/test';

export const SEARCH_PLACEHOLDER = 'ETF, 지수, 테마, 종목, 운용사 검색';

// The app fetches data/etfs.json before rendering, so navigation helpers wait
// for a stable landmark heading of the requested view.
export async function gotoCompareHome(page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'ETF 비교', exact: true })).toBeVisible();
}

export async function gotoAnalysisDeepLink(page, code) {
  await page.goto(`./?code=${code}`);
  await expect(page.getByRole('heading', { name: 'ETF 개별 분석', exact: true })).toBeVisible();
}

// The "ETF 탐색" universe strip, located by its heading rather than CSS class.
export function universeStrip(page) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'ETF 탐색', exact: true }) });
}
