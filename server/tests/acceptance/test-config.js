const path = require('path')

const required = ['webBaseURL', 'apiBaseURL', 'socketURL', 'adminPassword']

const config = {
  webBaseURL: process.env.ACCEPTANCE_WEB_URL,
  apiBaseURL: process.env.ACCEPTANCE_API_URL,
  socketURL: process.env.ACCEPTANCE_SOCKET_URL,
  socketPath: process.env.ACCEPTANCE_SOCKET_PATH || '/family-war/socket.io',
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
