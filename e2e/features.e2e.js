import { expect, test } from 'playwright/test';
import { gotoCompareHome } from './helpers.js';

test.describe('dark mode and list view', () => {
  test('theme toggle switches to dark mode and persists across reload', async ({ page }) => {
    await gotoCompareHome(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: '다크 모드로 전환' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: '라이트 모드로 전환' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('list view shows the sortable full universe and deep-links via ?view=list', async ({
    page,
  }) => {
    await gotoCompareHome(page);

    await page.getByRole('tab', { name: '전체 목록' }).click();
    await expect(page.getByRole('heading', { name: 'ETF 전체 목록', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/view=list/);

    const table = page.locator('.etf-table');
    await expect(table.locator('tbody tr')).toHaveCount(50);

    // Default sort is AIYN score descending; switching to expense ratio
    // re-sorts and flags the active column for assistive tech.
    await table.getByRole('button', { name: '총보수' }).click();
    await expect(table.locator('th').filter({ hasText: '총보수' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    // Direct deep link into the list view.
    await page.goto('./?view=list');
    await expect(page.getByRole('heading', { name: 'ETF 전체 목록', exact: true })).toBeVisible();
  });

  test('list row opens the analysis view and back returns to the list', async ({ page }) => {
    await gotoCompareHome(page);
    await page.getByRole('tab', { name: '전체 목록' }).click();
    await expect(page.getByRole('heading', { name: 'ETF 전체 목록', exact: true })).toBeVisible();

    await page.locator('.etf-table tbody tr').first().click();
    await expect(page.getByRole('heading', { name: 'ETF 개별 분석', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/code=/);

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'ETF 전체 목록', exact: true })).toBeVisible();
  });
});
