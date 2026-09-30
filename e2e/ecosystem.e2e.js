import { expect, HUB_ORIGIN, test, universeStrip } from './helpers.js';

// Value Compass ecosystem integration: shared theme parameter and key, the
// <vc-shell> bar, embed mode, the ETF theme filter's etf_theme key, and a
// first render that never waits on the home server.
const ANALYSIS_HEADING = { name: 'ETF 개별 분석', exact: true };
const QQQ_SHORT_NAME = 'Invesco QQQ Trust, Series 1';

test.describe('Value Compass ecosystem', () => {
  test('?theme=dark applies without storing and survives in-app navigation', async ({ page }) => {
    await page.goto('./?theme=dark&code=069500');
    await expect(page.getByRole('heading', ANALYSIS_HEADING)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => globalThis.localStorage.getItem('theme'))).toBeNull();

    await page.getByPlaceholder('이름 일부·코드·보유종목 검색').fill(QQQ_SHORT_NAME);
    await universeStrip(page).getByRole('button', { name: QQQ_SHORT_NAME }).click();
    await expect(page).toHaveURL(/code=QQQ/);
    await expect(page).toHaveURL(/theme=dark/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('the theme toggle writes the shared key and drops the one-off ?theme', async ({ page }) => {
    await page.goto('./?theme=dark&view=list');
    await page.getByRole('button', { name: '라이트 모드로 전환' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => globalThis.localStorage.getItem('theme'))).toBe('light');
    await expect(page).not.toHaveURL(/theme=/);
  });

  test('a legacy ?theme=<category> link still filters and is rewritten to etf_theme', async ({
    page,
  }) => {
    await page.goto(`./?view=list&theme=${encodeURIComponent('배당')}`);
    await expect(page.getByRole('heading', { name: 'ETF 전체 목록', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/etf_theme=%EB%B0%B0%EB%8B%B9/);
    await expect(page).not.toHaveURL(/[?&]theme=/);
    await expect(page.locator('#search .result-count')).toHaveText(/[1-9]\d*개/);
  });

  test('the ecosystem bar sits above the app and offers hub analysis for KRX codes', async ({
    page,
  }) => {
    await page.goto('./?code=069500');
    await expect(page.getByRole('heading', ANALYSIS_HEADING)).toBeVisible();
    const bar = page.locator('vc-shell[tool="eiayn"]');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('stock', '069500');
    const barBox = await bar.boundingBox();
    const shellBox = await page.locator('.app-shell').boundingBox();
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(shellBox.y + 1);

    await page.goto('./?code=QQQ');
    await expect(page.getByRole('heading', ANALYSIS_HEADING)).toBeVisible();
    await expect(bar).not.toHaveAttribute('stock', /.+/);
  });

  test('?embed hides the ecosystem bar, sidebar and top bar', async ({ page }) => {
    await page.goto('./?embed=1&code=069500');
    await expect(page.getByRole('heading', ANALYSIS_HEADING)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-embed', '1');
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('vc-shell')).toBeHidden();
  });

  test('the first render does not wait for the home server', async ({ page }) => {
    // Overrides the helper's instant stub: the hub never answers.
    await page.route(`${HUB_ORIGIN}/**`, () => {});
    await page.goto('./?code=069500#vc-held=069500:10', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', ANALYSIS_HEADING)).toBeVisible();
    // The unconsumed holdings fragment is cleared after 5 s.
    await expect(page).not.toHaveURL(/vc-held/, { timeout: 8_000 });
  });
});
