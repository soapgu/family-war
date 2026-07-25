const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const STATE_PATH = path.join(__dirname, '..', 'output', 'state.json')

/**
 * 创建一份尚未开始执行的默认状态。
 *
 * @returns {import('../types').AcceptanceState}
 */
function defaultState() {
  return {
    schemaVersion: 2,
    gitCommit: '',
    adminBaseURL: '',
    apiBaseURL: '',
    planVersion: 'v3.3 Phase 3',
    completed: [],
    current: null,
    failed: [],
    startedAt: null,
  }
}

/**
 * 获取当前 Git 短提交号，用作续跑指纹的一部分。
 *
 * @returns {string}
 */
function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * 加载与当前代码和环境匹配的续跑状态。
 *
 * @param {import('../types').AcceptanceConfig} config 验收配置。
 * @returns {import('../types').AcceptanceState | null}
 */
function load(config) {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'))
    const gitCommit = getGitCommit()
    if (
      data.schemaVersion !== 2 ||
      data.gitCommit !== gitCommit ||
      data.adminBaseURL !== config.adminBaseURL ||
      data.apiBaseURL !== config.apiBaseURL
    ) {
      console.log('运行指纹不匹配，请使用 --reset 重新开始')
      return null
    }
    return data
  } catch {
    return null
  }
}

/**
 * 以临时文件加重命名的方式原子保存状态。
 *
 * @param {import('../types').AcceptanceState} data 待保存状态。
 * @returns {void}
 */
function saveSync(data) {
  const dir = path.dirname(STATE_PATH)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = STATE_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, STATE_PATH)
}

module.exports = { defaultState, getGitCommit, load, saveSync }
