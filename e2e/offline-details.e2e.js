import { expect, test } from 'playwright/test';

test('캐시된 목록과 상세는 오프라인에서 열리고 미조회 상세는 오류를 알린다', async ({
  page,
  context,
}) => {
  await page.goto('./?code=QQQ');
  await page.evaluate(() => globalThis.navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator('.single-etf-dashboard')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const cache = await globalThis.caches.open('eiayn-static-v2');
        const keys = await cache.keys();
        return keys.some((req) => /\/runtime-data\/[a-f0-9]{24}\.json$/.test(req.url));
      }),
    )
    .toBe(true);
  // 브라우저 오프라인 설정과 함께 워커의 네트워크 실패도 재현합니다.
  const worker = context.serviceWorkers()[0];
  await worker.evaluate(() => {
    globalThis.onlineFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new TypeError('오프라인 네트워크'));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.single-etf-dashboard')).toBeVisible();
  await page.getByRole('combobox', { name: 'ETF 검색', exact: true }).fill('SCHD');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.getByRole('combobox', { name: 'ETF 검색', exact: true }).press('ArrowDown');
  await page.getByRole('combobox', { name: 'ETF 검색', exact: true }).press('Enter');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.single-etf-dashboard')).toHaveCount(0);
  await context.setOffline(false);
  await worker.evaluate(() => {
    globalThis.fetch = globalThis.onlineFetch;
  });
  await page.getByRole('button', { name: '상세 다시 시도', exact: true }).click();
  await expect(page.locator('.single-etf-dashboard')).toBeVisible();
});
