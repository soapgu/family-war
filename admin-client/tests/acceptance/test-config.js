const path = require('path')

/** 必须由运行环境提供的配置项。 */
const required = ['adminBaseURL', 'apiBaseURL', 'adminPassword']

/** @type {import('./types').AcceptanceConfig} */
const config = {
  adminBaseURL: process.env.ACCEPTANCE_ADMIN_URL,
  apiBaseURL: process.env.ACCEPTANCE_API_URL,
  apiPath: '',
  adminPassword: process.env.ACCEPTANCE_ADMIN_PASSWORD,
  headless: process.env.HEADED !== '1',
  stepTimeoutOverride: process.env.ACCEPTANCE_STEP_TIMEOUT
    ? parseInt(process.env.ACCEPTANCE_STEP_TIMEOUT, 10)
    : undefined,
  screenshotDir:
    process.env.ACCEPTANCE_SCREENSHOT_DIR ||
    path.join(__dirname, 'output/screenshots'),
}

// 尽早报告缺失配置，避免启动浏览器后才失败。
for (const key of required) {
  if (config[key] === undefined || config[key] === null) {
    throw new Error(`缺少验收配置：${key}`)
  }
}

const apiURL = new URL(config.apiBaseURL)
// 统一 API 地址格式，供 Node 请求与页面内请求共同使用。
config.apiBaseURL = config.apiBaseURL.replace(/\/+$/, '')
config.apiPath = apiURL.pathname.replace(/\/+$/, '')

module.exports = config
