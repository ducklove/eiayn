import { expect, test } from 'playwright/test';
import { Buffer } from 'node:buffer';
test.use({ serviceWorkers: 'block' });

test('목록은 상세 자료 없이 검색하고 선택한 ETF만 상세를 요청한다', async ({ page }) => {
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto('./?view=list');
  await expect(page.getByRole('heading', { name: 'ETF 전체 목록', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'ETF 검색', exact: true }).fill('삼성 전자');
  await expect(page.locator('.search-results-summary')).toContainText(/[1-9]\d*개/);
  expect(
    requested.some((url) => /\/data\/etfs\.json|\/runtime-data\/[a-f0-9]{24}\.json/.test(url)),
  ).toBe(false);
  await page.getByRole('combobox', { name: 'ETF 검색', exact: true }).fill('069500');
  await page.getByRole('combobox', { name: 'ETF 검색', exact: true }).press('ArrowDown');
  await page.getByRole('combobox', { name: 'ETF 검색', exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'KODEX 200', exact: true })).toBeVisible();
  expect(requested.filter((url) => /\/runtime-data\/[a-f0-9]{24}\.json/.test(url))).toHaveLength(1);
  await expect(page.getByText(/수집:/)).toBeVisible();
});

test('목록과 다른 버전의 상세 자료는 표시하지 않고 재시도로 복구한다', async ({ page }) => {
  let corrupt = true;
  await page.route('**/runtime-data/*.json', async (route) => {
    if (route.request().url().endsWith('/catalog.json')) return route.continue();
    const response = await route.fetch();
    const json = await response.json();
    if (corrupt) json.snapshotVersion = 'old-snapshot';
    await route.fulfill({ json });
  });
  await page.goto('./?code=QQQ');
  await expect(page.getByRole('alert')).toContainText('버전 또는 형식이 다릅니다');
  await expect(page.locator('.single-etf-dashboard')).toHaveCount(0);
  corrupt = false;
  await page.getByRole('button', { name: '상세 다시 시도', exact: true }).click();
  await expect(page.locator('.single-etf-dashboard')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('다른 화면의 사이드바 메뉴가 대상 화면을 연 뒤 이동한다', async ({ page }) => {
  for (const [label, target] of [
    ['평가 모델', '#score-model'],
    ['수익률 랭킹', '#ranking'],
    ['선택 ETF 3', '#basket'],
    ['관심상품', '#favorite-list'],
    ['투자 유의', '#risk'],
  ]) {
    await page.goto('./?view=list');
    await page
      .getByRole('navigation', { name: '주요 메뉴' })
      .getByRole('link', { name: label, exact: true })
      .click();
    await expect(page.locator(target)).toBeInViewport();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
  }
});

test('랭킹은 같은 시장과 자산군에서 충족도가 높은 ETF를 추린다', async ({ page }) => {
  await page.goto('./?view=ranking');
  await page.getByRole('combobox', { name: '랭킹 비교 시장' }).selectOption('국내');
  await page.getByRole('combobox', { name: '랭킹 자산군' }).selectOption('채권');
  await page.getByRole('combobox', { name: '랭킹 최소 충족도' }).selectOption('0.8');
  const rows = page.locator('.aiyn-ranking-table tbody tr');
  expect(await rows.count()).toBeGreaterThan(0);
  for (const row of await rows.all()) {
    await expect(row.locator('td').nth(2)).toHaveText('국내');
    const coverage = await row.locator('.coverage-badge').innerText();
    expect(Number(coverage.match(/\d+/)[0])).toBeGreaterThanOrEqual(80);
  }
  await expect(page.getByRole('columnheader', { name: 'AUM (USD)' })).toBeVisible();
  const count = await rows.count();
  await page.reload();
  await expect(page.getByRole('combobox', { name: '랭킹 비교 시장' })).toHaveValue('국내');
  await expect(page.getByRole('combobox', { name: '랭킹 자산군' })).toHaveValue('채권');
  await expect(page.getByRole('combobox', { name: '랭킹 최소 충족도' })).toHaveValue('0.8');
  await expect(rows).toHaveCount(count);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '랭킹 내보내기' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv.trim().split(/\r?\n/)).toHaveLength(count + 1);
  expect(csv).toContain('aumUsd');
});

test('과거 산식의 점수와 새 산식의 점수를 이어 그리지 않는다', async ({ page }) => {
  await page.route('**/data/history.json', (route) =>
    route.fulfill({
      json: {
        entries: [
          { date: '2026-09-09', scores: { QQQ: 95 }, scoreModelVersion: '1.0.0' },
          { date: '2026-09-10', scores: { QQQ: 80 }, scoreModelVersion: '2.0.0' },
          { date: '2026-09-11', scores: { QQQ: 81 }, scoreModelVersion: '2.0.0' },
        ],
      },
    }),
  );
  await page.goto('./?code=QQQ');
  const panel = page.locator('.score-trend');
  await expect(panel).toContainText('산식 2.0.0');
  await expect(panel).toContainText('+1점 (2일)');
  await expect(panel).not.toContainText('95점');
});

test('느린 이전 상세 응답이 새로 선택한 ETF를 덮어쓰지 않는다', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let first = true;
  await page.route('**/runtime-data/*.json', async (route) => {
    if (route.request().url().endsWith('/catalog.json')) return route.continue();
    if (first) {
      first = false;
      await gate;
    }
    try {
      await route.continue();
    } catch {
      /* 취소된 이전 요청 */
    }
  });
  await page.goto('./?code=QQQ');
  await expect(page.getByText('선택한 ETF의 상세 데이터를 불러오는 중입니다.')).toBeVisible();
  await page.getByRole('combobox', { name: 'ETF 검색', exact: true }).fill('SCHD');
  await expect(page.getByRole('listbox')).toContainText('SCHD');
  await page.getByRole('combobox', { name: 'ETF 검색', exact: true }).press('ArrowDown');
  await page.getByRole('combobox', { name: 'ETF 검색', exact: true }).press('Enter');
  await expect(page.locator('.single-etf-dashboard h2')).toHaveText(
    'Schwab U.S. Dividend Equity ETF',
  );
  release();
  await expect(page).toHaveURL(/code=SCHD/);
  await expect(page.locator('.single-etf-dashboard h2')).toHaveText(
    'Schwab U.S. Dividend Equity ETF',
  );
});
