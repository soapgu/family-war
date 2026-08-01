import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config.js'

const experimentWebServer = Array.isArray(baseConfig.webServer)
  ? baseConfig.webServer.map((entry, index) => (
      index === 0
        ? { ...entry, command: 'E2E_EXPERIMENT=1 npm run dev:server --prefix ..' }
        : entry
    ))
  : baseConfig.webServer

export default defineConfig({
  ...baseConfig,
  testDir: './tests/experiments',
  timeout: 10 * 60 * 1000,
  outputDir: 'tests/e2e/test-results/experiments/artifacts',
  reporter: [
    ['html', { outputFolder: 'tests/e2e/test-results/experiments/html', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'tests/e2e/test-results/experiments/playwright-results.json' }],
  ],
  webServer: experimentWebServer,
})
