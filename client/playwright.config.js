import { defineConfig } from '@playwright/test'

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
    ['html', { outputFolder: 'tests/e2e/e2e-report' }],
    ['list'],
  ],
})
