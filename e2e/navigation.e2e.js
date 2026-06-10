import { expect, test } from 'playwright/test';
import {
  gotoAnalysisDeepLink,
  gotoCompareHome,
  SEARCH_PLACEHOLDER,
  universeStrip,
} from './helpers.js';

// QQQ is guaranteed to exist in the committed snapshot by scripts/check-data.mjs,
// so the specs can rely on it as a stable fixture. The full short name matches a
// single ETF, which keeps it inside the 8-button universe strip.
const QQQ_SHORT_NAME = 'Invesco QQQ Trust, Series 1';
const QQQ_NAME = 'Invesco QQQ Trust';

test.describe('search, deep links, and history', () => {
  test('search filters the universe strip and opens individual analysis', async ({ page }) => {
    await gotoCompareHome(page);

    await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill(QQQ_SHORT_NAME);
    await expect(page.getByText('1개 검색됨')).toBeVisible();

    await universeStrip(page).getByRole('button', { name: QQQ_SHORT_NAME }).click();

    await expect(page.getByRole('heading', { name: 'ETF 개별 분석', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: QQQ_NAME, exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\?code=QQQ$/);
  });

  test('deep link with ?code=QQQ opens the analysis view directly', async ({ page }) => {
    await gotoAnalysisDeepLink(page, 'QQQ');

    await expect(page.getByRole('heading', { name: QQQ_NAME, exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\?code=QQQ$/);
  });

  test('browser back returns from analysis to the compare view', async ({ page }) => {
    await gotoCompareHome(page);

    await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill(QQQ_SHORT_NAME);
    await universeStrip(page).getByRole('button', { name: QQQ_SHORT_NAME }).click();
    await expect(page.getByRole('heading', { name: 'ETF 개별 분석', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\?code=QQQ$/);

    await page.goBack();

    await expect(page.getByRole('heading', { name: 'ETF 비교', exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/code=/);
  });

  test('analysis view shows the AIYN score panel with a coverage badge', async ({ page }) => {
    await gotoAnalysisDeepLink(page, 'QQQ');

    await expect(page.getByText('AIYN 점수', { exact: true })).toBeVisible();
    await expect(page.getByText(/데이터 충족도 \d+%/)).toBeVisible();
  });
});
