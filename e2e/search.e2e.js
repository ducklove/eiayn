import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { expect, test } from 'playwright/test';
import { gotoCompareHome } from './helpers.js';

test.use({ serviceWorkers: 'block' });

test.describe('검색 흐름', () => {
  test('화면에는 전체로 보이는 잘못된 필터값이 배당 검색을 막지 않는다', async ({ page }) => {
    await page.goto('./?view=list&q=배당&market=전체&theme=전체&provider=전체&risk=전체');
    await expect(page.locator('.etf-table tbody tr').first()).toContainText('배당');
    const filters = page.locator('.filter-select select');
    await expect(filters.nth(0)).toHaveValue('시장 전체');
    await expect(filters.nth(1)).toHaveValue('테마 전체');
    await expect(filters.nth(2)).toHaveValue('운용사 전체');
    await expect(filters.nth(3)).toHaveValue('리스크 전체');
    await page.getByRole('combobox', { name: 'ETF 검색' }).focus();
    await expect(page.locator('.search-results-summary')).toContainText(
      /전체 ETF에서 [1-9]\d*개 검색됨/,
    );
  });

  test('이름 일부와 띄어쓰기 변형을 검색하고 전체 결과를 연다', async ({ page }) => {
    await gotoCompareHome(page);
    const input = page.getByRole('combobox', { name: 'ETF 검색' });
    await input.fill('KODEX200');
    await expect(page.getByRole('option').first()).toContainText('KODEX 200');
    await expect(page.getByRole('option').first()).toContainText('ETF명 일치');
    await input.press('Enter');
    await expect(page.getByRole('heading', { name: 'ETF 전체 목록', exact: true })).toBeVisible();
    await expect(page.locator('.etf-table tbody tr').first()).toContainText('069500');
    await expect(page.getByRole('button', { name: '검색 관련도순' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page).toHaveURL(/q=KODEX200/);
    await expect(page.getByRole('button', { name: '검색 결과 내보내기' })).toBeVisible();
    await input.fill('나스닥 100');
    await expect(page.getByRole('option').first()).toContainText('나스닥100');
    await input.fill('미국 배당');
    await expect(page.getByRole('option').first()).toContainText('배당');
  });

  test('다른 시장 필터가 있어도 전체 ETF를 찾고 검색 버튼으로 필터를 해제한다', async ({
    page,
  }) => {
    await page.goto('./?view=list&market=국내');
    const input = page.getByRole('combobox', { name: 'ETF 검색' });
    await input.fill('QQQ');
    await expect(page.getByRole('option').first()).toContainText('QQQ · 미국');
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await expect(page.locator('.filter-select select').first()).toHaveValue('시장 전체');
    await expect(page.locator('.etf-table tbody tr').first()).toContainText('Invesco QQQ');
    await expect(page).not.toHaveURL(/market=/);
  });

  test('방향키로 선택해 분석을 열고 뒤로가기와 새로고침으로 조건을 복원한다', async ({ page }) => {
    await page.goto('./?view=list&q=KODEX200&market=국내');
    const input = page.getByRole('combobox', { name: 'ETF 검색' });
    await input.focus();
    await expect(page.getByRole('option').first()).toContainText('069500');
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page).toHaveURL(/code=069500/);
    await input.fill('QQQ');
    await page.goBack();
    await expect(input).toHaveValue('KODEX200');
    await expect(page.locator('.filter-select select').first()).toHaveValue('국내');
    await page.reload();
    await expect(input).toHaveValue('KODEX200');
    await expect(page.locator('.etf-table tbody tr').first()).toContainText('069500');
  });

  test('빈 검색창에 예시를 안내하고 검색어를 지울 수 있다', async ({ page }) => {
    await gotoCompareHome(page);
    const input = page.getByRole('combobox', { name: 'ETF 검색' });
    await input.focus();
    await page.getByRole('button', { name: 'KODEX200', exact: true }).click();
    await expect(input).toHaveValue('KODEX200');
    await expect(page.getByRole('option').first()).toContainText('069500');
    await page.getByRole('button', { name: '검색어 지우기' }).click();
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
  });

  test('결과가 없으면 복구 방법을 안내하고 무관한 하단 랭킹을 숨긴다', async ({ page }) => {
    await gotoCompareHome(page);
    const input = page.getByRole('combobox', { name: 'ETF 검색' });
    await input.fill('존재하지않는종목xyz');
    await expect(page.locator('.search-guidance')).toContainText('이름을 짧게');
    await input.press('Escape');
    await expect(page.locator('#ranking .ranking-row')).toHaveCount(0);
    await page.getByRole('button', { name: '검색어 존재하지않는종목xyz 해제' }).click();
    await expect(page.locator('#ranking .ranking-row')).toHaveCount(5);
  });

  test('오래되거나 잘못된 URL 필터를 무시한다', async ({ page }) => {
    await page.goto('./?view=list&q=KODEX200&provider=존재하지않는운용사');
    await expect(page.locator('.filter-select select').nth(2)).toHaveValue('운용사 전체');
    await expect(page.locator('.etf-table tbody tr').first()).toContainText('069500');
  });
});

test.describe('오류 복구', () => {
  test('첫 데이터 요청 실패를 표시하고 재시도로 복구한다', async ({ page }) => {
    const snapshot = readFileSync(new URL('../public/data/etfs.json', import.meta.url), 'utf8');
    let fail = true;
    await page.route('**/runtime-data/catalog.json', (route) =>
      fail
        ? route.fulfill({ status: 503, body: 'unavailable' })
        : route.fulfill({ status: 200, contentType: 'application/json', body: snapshot }),
    );
    await page.goto('./');
    await expect(page.getByRole('heading', { name: '데이터를 불러오지 못했습니다' })).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(page.getByRole('heading', { name: 'ETF 비교', exact: true })).toBeVisible();
  });

  test('빈 데이터와 손상된 저장값을 처리한다', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.localStorage.setItem('eiayn:favorites:v1', 'null');
      globalThis.localStorage.setItem('eiayn:recent:v1', '{}');
    });
    await gotoCompareHome(page);
    await page.route('**/runtime-data/catalog.json', (route) =>
      route.fulfill({ json: { etfs: [] } }),
    );
    await page.reload();
    await expect(page.getByRole('heading', { name: '데이터를 불러오지 못했습니다' })).toBeVisible();
    await expect(page.getByText(/데이터가 비어 있거나/)).toBeVisible();
  });
});

test.describe('모바일 검색', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('작은 화면에서 검색 결과를 터치해 분석으로 이동한다', async ({ page }) => {
    await gotoCompareHome(page);
    const input = page.getByRole('combobox', { name: 'ETF 검색' });
    await input.fill('KODEX200');
    const popup = page.locator('.search-results-popover');
    await expect(page.getByRole('option').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /검색 결과 \d+개 전체 보기/ })).toBeInViewport();
    const bounds = await popup.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await page.getByRole('option').first().tap();
    await expect(page.getByRole('heading', { name: 'ETF 개별 분석', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/code=069500/);
    await expect(page.getByRole('button', { name: '다크 모드로 전환' })).toBeVisible();
  });
});
