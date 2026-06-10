/* global process */
import { defineConfig, devices } from 'playwright/test';

// E2E suite for the static ETF dashboard. The webServer block builds the app
// hermetically (check:data + vite build, no external API calls) and serves
// dist/ with `vite preview` at the GitHub Pages base path /eiayn/.
export default defineConfig({
  testDir: 'e2e',
  // *.e2e.js keeps these specs out of vitest's default *.spec.js include.
  testMatch: '**/*.e2e.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Keep the `list` reporter everywhere; in CI also write the HTML report
  // (which bundles traces) so the workflow can upload it as a failure artifact.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173/eiayn/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173/eiayn/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
