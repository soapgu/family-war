const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const STATE_PATH = path.join(__dirname, '..', 'output', 'state.json')

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

function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

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

function saveSync(data) {
  const dir = path.dirname(STATE_PATH)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = STATE_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, STATE_PATH)
}

module.exports = { defaultState, getGitCommit, load, saveSync }
