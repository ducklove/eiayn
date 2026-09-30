import { test as base, expect } from 'playwright/test';

// The hub (home server) hosts portfolio-held-badges.js. E2E runs must never
// depend on it, so every page gets a stub that answers instantly with an
// empty script. Specs import `test` from here instead of 'playwright/test'.
export const HUB_ORIGIN = 'https://ducklove.duckdns.org:3691';

export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route(`${HUB_ORIGIN}/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }),
    );
    await provide(page);
  },
});

export { expect };

export const SEARCH_PLACEHOLDER = '이름 일부·코드·보유종목 검색';

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
