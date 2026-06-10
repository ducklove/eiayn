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

  test('preset chip applies filters and switches to the list view', async ({ page }) => {
    await gotoCompareHome(page);

    await page.getByRole('button', { name: '커버드콜' }).click();

    await expect(page.getByRole('heading', { name: 'ETF 전체 목록', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/view=list/);
    // The 커버드콜 theme preset narrows the universe well below the full 1,348.
    const heading = page.getByRole('heading', { name: /전체 목록 \(\d+\)/ });
    await expect(heading).toBeVisible();
    await expect(heading).not.toContainText('(1348)');
    await expect(page.locator('.filter-select select').nth(1)).toHaveValue('커버드콜');
  });

  test('cost calculator translates expense ratios into won figures', async ({ page }) => {
    await gotoCompareHome(page);

    const calculator = page.locator('.cost-calculator');
    await expect(calculator.getByRole('heading', { name: '총보수 비용 계산기' })).toBeVisible();
    // Three default compared ETFs -> three cost rows with annual figures.
    await expect(calculator.locator('.cost-row')).toHaveCount(3);
    await expect(calculator.locator('.cost-row').first()).toContainText(/연 [\d,]+/);

    // Doubling the holding period is reflected in the cumulative label.
    await calculator.getByLabel('보유기간 (년)').fill('10');
    await expect(calculator.locator('.cost-row').first()).toContainText(/10년 누적/);
  });

  test('performance overlay shows its placeholder until series data ships', async ({ page }) => {
    await gotoCompareHome(page);

    const overlay = page.locator('.performance-overlay');
    await expect(overlay.getByRole('heading', { name: /성과 비교/ })).toBeVisible();
    // The committed snapshot predates performance1y, so the honest empty state shows.
    await expect(overlay.locator('.empty-state')).toContainText('다음 데이터 갱신');
  });
});
