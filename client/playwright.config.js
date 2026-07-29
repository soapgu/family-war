import { defineConfig } from '@playwright/test'

/**
 * v3.6 Phase 1 E2E 装配（step.md 1c，Phase 0 风格：webServer 自管）
 *
 * Playwright 通过 `webServer` 自动启停 client + server 进程。
 * 详细说明见 docs/acceptance/v3.6/e2e-setup.md §10-12。
 */
const EXTERNAL_BASE_URL = !!process.env.CLIENT_BASE_URL

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  outputDir: 'tests/e2e/test-results',
  use: {
    baseURL: process.env.CLIENT_BASE_URL || 'http://localhost:3000/family-war/',
    headless: process.env.HEADED !== '1',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  reporter: [
    ['html', { outputFolder: 'tests/e2e/e2e-report', open: 'never' }],
    ['list'],
  ],
  webServer: EXTERNAL_BASE_URL
    ? undefined
    : [
        {
          command: 'E2E_FAST=1 npm run dev:server --prefix ..',
          url: 'http://localhost:4000/api/health',
          reuseExistingServer: false,
          stdout: 'pipe',
          timeout: 30000,
        },
        {
          command: 'npm run dev:client --prefix ..',
          url: 'http://localhost:3000/family-war/',
          reuseExistingServer: false,
          stdout: 'pipe',
          timeout: 60000,
        },
      ],
})
