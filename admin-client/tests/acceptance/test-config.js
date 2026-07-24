const path = require('path')

const required = ['adminBaseURL', 'apiBaseURL', 'adminPassword']

const config = {
  adminBaseURL: process.env.ACCEPTANCE_ADMIN_URL,
  apiBaseURL: process.env.ACCEPTANCE_API_URL,
  adminPassword: process.env.ACCEPTANCE_ADMIN_PASSWORD,
  headless: process.env.HEADED !== '1',
  stepTimeoutOverride: process.env.ACCEPTANCE_STEP_TIMEOUT
    ? parseInt(process.env.ACCEPTANCE_STEP_TIMEOUT, 10)
    : undefined,
  screenshotDir:
    process.env.ACCEPTANCE_SCREENSHOT_DIR ||
    path.join(__dirname, 'output/screenshots'),
}

for (const key of required) {
  if (config[key] === undefined || config[key] === null) {
    throw new Error(`缺少验收配置：${key}`)
  }
}

module.exports = config
