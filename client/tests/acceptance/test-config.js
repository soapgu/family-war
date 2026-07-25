const path = require('path')

const config = {
  baseURL: (process.env.CLIENT_BASE_URL || 'http://localhost:3000/family-war/').replace(/\/+$/, '') + '/',
  headless: process.env.HEADED !== '1',
  stepTimeout: parseInt(process.env.ACCEPTANCE_STEP_TIMEOUT || '60000', 10),
  screenshotDir:
    process.env.ACCEPTANCE_SCREENSHOT_DIR ||
    path.join(__dirname, 'output/screenshots'),
}

module.exports = config
