import { expect, test } from 'playwright/test';
import { gotoCompareHome, SEARCH_PLACEHOLDER } from './helpers.js';

test.describe('dashboard smoke', () => {
  test('loads the comparison dashboard with three default ETFs', async ({ page }) => {
    await gotoCompareHome(page);

    await expect(
      page.getByRole('heading', { name: 'ETF is All You Need', exact: true }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeVisible();
    await expect(page.getByRole('heading', { name: /비교 중인 ETF \(3\)/ })).toBeVisible();
  });

  test('footer shows the last update time in KST format', async ({ page }) => {
    await gotoCompareHome(page);

    await expect(page.getByRole('contentinfo')).toContainText(
      /마지막 업데이트: \d{4}-\d{2}-\d{2} \d{2}:\d{2} KST/,
    );
  });

  test('pressing "/" focuses the unified search input', async ({ page }) => {
    await gotoCompareHome(page);

    await page.keyboard.press('/');

    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeFocused();
  });

  test('usage guide opens as a dialog and closes with Escape', async ({ page }) => {
    await gotoCompareHome(page);

    await page.getByRole('button', { name: '사용 가이드' }).click();
    const dialog = page.getByRole('dialog', { name: '사용 가이드' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('compare export downloads an eiayn CSV file', async ({ page }) => {
    await gotoCompareHome(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '비교 내보내기' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^eiayn-.+\.csv$/);
  });
});
