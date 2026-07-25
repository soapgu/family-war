#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..', '..')
const CONFIG_LOCAL_PATH = path.join(REPOSITORY_ROOT, 'server', 'config.local.js')
const CHECK_ONLY = process.argv.slice(2).includes('--check')

const { execSync } = require('child_process')
const { chromium } = require('@playwright/test')
const config = CHECK_ONLY ? null : require('./test-config')
const stateLib = require('./lib/state')
const reporterLib = require('./lib/reporter')
const cleanup = require('./lib/cleanup')
const { ensureAuthenticated } = require('./lib/auth')

const STEPS_DIR = path.join(__dirname, 'steps')
const OUTPUT_DIR = path.join(__dirname, 'output')
const STEP_FILES = [
  '01-precheck.js',
  '02-auth.js',
  '03-dashboard.js',
  '04-word-config.js',
  '05-images.js',
  '06-responsive.js',
]
let configLocalBackup = null  // 内存备份，避免文件系统竞争

const DEFAULT_STEP_TIMEOUT = 60000

/** 重启服务端进程，使临时认证配置生效。 */
function pm2Restart() {
  execSync('pm2 restart family-war-server', { stdio: 'inherit' })
}

/**
 * 轮询健康端点，并可选验证管理员密码保护已生效。
 *
 * @param {string} url 健康检查地址。
 * @param {number} [maxRetries=30] 最大重试次数。
 * @param {number} [delay=1000] 重试间隔（毫秒）。
 * @param {boolean} [checkPassword=true] 是否同时探测密码保护。
 * @returns {Promise<void>}
 */
async function waitForHealth(url, maxRetries = 30, delay = 1000, checkPassword = true) {
  const http = require('http')
  const apiBase = config.apiBaseURL
  const passwordSet = config.adminPassword && config.adminPassword !== ''
  for (let i = 0; i < maxRetries; i++) {
    try {
      const body = await new Promise((resolve, reject) => {
        const r = http.get(url, res => {
          let d = ''
          res.on('data', c => d += c)
          res.on('end', () => resolve(d))
        })
        r.on('error', reject)
        r.setTimeout(2000, () => { r.destroy(); reject(new Error('timeout')) })
      })
      const data = JSON.parse(body)
      if (data.status !== 'ok') continue
    } catch {
      await new Promise(r => setTimeout(r, delay))
      continue
    }
    // 健康检查通过后，再确认新进程已经加载密码配置。
    if (passwordSet && checkPassword) {
      const loginBody = await new Promise((resolve, reject) => {
        const postData = JSON.stringify({ password: 'probe-wrong' })
        const options = {
          hostname: new URL(apiBase).hostname,
          port: new URL(apiBase).port,
          path: new URL(apiBase).pathname + '/admin/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
        }
        const r = http.request(options, res => {
          let d = ''
          res.on('data', c => d += c)
          res.on('end', () => resolve(d))
        })
        r.on('error', reject)
        r.setTimeout(5000, () => { r.destroy(); reject(new Error('timeout')) })
        r.write(postData)
        r.end()
      })
      const loginData = JSON.parse(loginBody)
      if (loginData.error !== '密码错误') {
        console.log('密码保护未生效，等待新进程...')
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      console.log('密码保护已生效')
    }
    return
  }
  throw new Error(`服务等待超时 ${maxRetries * delay}ms: ${url}`)
}

/**
 * 在内存中备份本地配置，并临时写入验收密码。
 *
 * @param {string} password 管理员密码。
 */
function backupAndSetAdminPassword(password) {
  if (!fs.existsSync(CONFIG_LOCAL_PATH)) return
  configLocalBackup = fs.readFileSync(CONFIG_LOCAL_PATH, 'utf-8')
  delete require.cache[require.resolve(CONFIG_LOCAL_PATH)]
  const current = require(CONFIG_LOCAL_PATH)
  current.auth = current.auth || {}
  current.auth.adminPassword = password
  const output = `module.exports = ${JSON.stringify(current, null, 2)}\n`
  fs.writeFileSync(CONFIG_LOCAL_PATH, output, 'utf-8')
  const readBack = fs.readFileSync(CONFIG_LOCAL_PATH, 'utf-8')
  if (readBack !== output) throw new Error('config.local.js 写入验证失败')
  console.log(`已写入 ${CONFIG_LOCAL_PATH} (auth.adminPassword)`)
}

/** 从内存备份恢复本地配置文件。 */
function restoreConfigLocal() {
  if (!configLocalBackup) {
    console.log('无内存备份，跳过恢复')
    return
  }
  fs.writeFileSync(CONFIG_LOCAL_PATH, configLocalBackup, 'utf-8')
  configLocalBackup = null
  console.log('已恢复 config.local.js')
}

/** 尽力恢复配置；清理失败只记录错误，不遮盖原始测试结果。 */
function cleanConfigLocal() {
  try { restoreConfigLocal() } catch (e) { console.error('恢复失败:', e.message) }
}

/** 单个验收步骤超过截止时间时抛出的错误。 */
class StepTimeoutError extends Error {
  /**
   * @param {string} id 步骤 ID。
   * @param {number} ms 超时时间。
   */
  constructor(id, ms) {
    super(`步骤 ${id} 超时 (${ms}ms)`)
    this.name = 'StepTimeoutError'
  }
}

/**
 * 为步骤 Promise 增加超时边界。
 *
 * @template T
 * @param {string} id 步骤 ID。
 * @param {Promise<T>} promise 步骤任务。
 * @param {number} ms 超时时间。
 * @returns {Promise<T>}
 */
function runStepWithTimeout(id, promise, ms) {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new StepTimeoutError(id, ms)), ms)
  })
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeoutPromise])
}

/** 离线检查步骤文件、服务端路径、Playwright 依赖和网络边界规则。 */
function checkSetup() {
  const requiredPaths = [
    CONFIG_LOCAL_PATH,
    path.join(REPOSITORY_ROOT, 'server', 'src', 'data'),
    ...STEP_FILES.map((file) => path.join(STEPS_DIR, file)),
  ]
  const missing = requiredPaths.filter((target) => !fs.existsSync(target))
  if (missing.length > 0) {
    throw new Error(`验收测试依赖路径缺失：\n${missing.join('\n')}`)
  }
  for (const file of STEP_FILES) {
    /** @type {import('./types').AcceptanceStep} */
    const step = require(path.join(STEPS_DIR, file))
    if (!step.id || typeof step.run !== 'function') {
      throw new Error(`验收步骤格式无效：${file}`)
    }
  }
  require.resolve('@playwright/test')
  assertAdminNetworkBoundary(
    ['http://localhost:8080/api/family-war/admin/status'],
    '/api/family-war',
  )
  for (const invalidURL of [
    'http://localhost:8080/family-war/api/admin/status',
    'http://localhost:8080/socket/family-war/?EIO=4',
    'http://localhost:8080/family-war/socket.io/?EIO=4',
  ]) {
    let rejected = false
    try {
      assertAdminNetworkBoundary([invalidURL], '/api/family-war')
    } catch {
      rejected = true
    }
    if (!rejected) throw new Error(`管理端网络边界未拒绝：${invalidURL}`)
  }
  console.log(`验收测试结构检查通过：${STEP_FILES.length} 个步骤，服务端路径与 Playwright 依赖可用`)
}

/**
 * 约束管理端只能访问规范的管理 API，且不得建立 Socket.IO 连接。
 *
 * @param {string[]} requestURLs 页面发出的请求地址。
 * @param {string} apiPath 允许的 API 路径前缀。
 */
function assertAdminNetworkBoundary(requestURLs, apiPath) {
  const socketRequests = requestURLs.filter((url) => {
    const parsed = new URL(url)
    return parsed.pathname.includes('/socket.io') || parsed.pathname.startsWith('/socket/')
  })
  if (socketRequests.length > 0) {
    throw new Error(`管理端发起了 Socket.IO 请求：${socketRequests.join(', ')}`)
  }

  const invalidAdminAPIs = requestURLs.filter((url) => {
    const pathname = new URL(url).pathname
    const isAdminAPI = pathname.includes('/api/admin/')
      || pathname.includes('/api/family-war/admin/')
    return isAdminAPI && !pathname.startsWith(`${apiPath}/admin/`)
  })
  if (invalidAdminAPIs.length > 0) {
    throw new Error(`管理 API 未使用 ${apiPath}/：${invalidAdminAPIs.join(', ')}`)
  }
}

let sigintCount = 0

/** 解析命令参数并编排完整的验收、续跑、报告和清理流程。 */
async function main() {
  const args = process.argv.slice(2)
  if (CHECK_ONLY) {
    checkSetup()
    return
  }
  const onlyRestore = args.includes('--restore-only')
  const reset = args.includes('--reset')

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err)
    process.exit(1)
  })

  process.on('SIGINT', () => {
    sigintCount++
    if (sigintCount === 1) {
      console.log('\n收到中断信号，正在执行恢复...')
      cleanConfigLocal()
      console.log('恢复完成，安全退出。再次 Ctrl+C 强制退出。')
      process.exit(130)
    } else {
      console.log('\n强制退出')
      process.exit(137)
    }
  })

  const stepTimeout = config.stepTimeoutOverride || DEFAULT_STEP_TIMEOUT

  // 如果设置了管理员密码，临时覆写 config.local.js 并重启。
  const hasPassword = config.adminPassword && config.adminPassword !== ''
  if (hasPassword) {
    try { backupAndSetAdminPassword(config.adminPassword) } catch (e) { console.error('写入 config.local.js 失败:', e.message) }
    pm2Restart()
    await waitForHealth(config.apiBaseURL + '/health')
  }

  if (onlyRestore) {
    console.log('--restore-only 模式：执行恢复...')
    await cleanup.restoreRegistered()
    console.log('恢复完成')
    process.exit(0)
  }

  if (reset) {
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
      console.log('已删除 output/ 目录')
    }
  }

  /** @type {import('./types').AcceptanceState | null} */
  let state
  if (!reset) {
    state = stateLib.load(config)
  }
  if (!state) {
    state = stateLib.defaultState()
    state.gitCommit = stateLib.getGitCommit()
    state.adminBaseURL = config.adminBaseURL
    state.apiBaseURL = config.apiBaseURL
    state.planVersion = 'v3.3 Phase 3'
    state.startedAt = new Date().toISOString()
    console.log('新建运行指纹')
  } else {
    console.log(
      `恢复运行: 已完成 [${state.completed.join(', ')}]` +
        (state.failed.length > 0 ? `, 失败 [${state.failed.join(', ')}]` : '')
    )
  }

  if (cleanup.hasPending()) {
    console.log('检测到未完成恢复，先执行恢复...')
    await cleanup.restoreRegistered()
  }

  const screenshotDir = config.screenshotDir
  fs.mkdirSync(screenshotDir, { recursive: true })
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const reporter = reporterLib.create(OUTPUT_DIR)

  // 加载步骤模块，并跳过当前运行指纹下已经完成的步骤。
  /** @type {(import('./types').AcceptanceStep & { file: string })[]} */
  const steps = STEP_FILES.map((f) => {
    /** @type {import('./types').AcceptanceStep} */
    const mod = require(path.join(STEPS_DIR, f))
    return { file: f, ...mod }
  }).filter((mod) => !state.completed.includes(mod.id))

  if (steps.length === 0) {
    console.log('所有步骤已完成。使用 --reset 重新运行。')
    return
  }

  console.log(`待执行步骤: [${steps.map((s) => s.id).join(', ')}]`)

  const browser = await chromium.launch({ headless: config.headless })

  let stepFailed = false
  try {
    for (const step of steps) {
      if (stepFailed) {
        console.log(`跳过 ${step.id} (前置步骤失败)`)
        continue
      }

      console.log(`\n=== 执行步骤 ${step.id} ===`)
      reporter.onStepStart(step.id, step.name)

      const context = await browser.newContext({ ignoreHTTPSErrors: true })
      const page = await context.newPage()
      /** @type {string[]} */
      const requestURLs = []
      page.on('request', (request) => requestURLs.push(request.url()))

      try {
        const run = async () => {
          if (step.requiresAuth) {
            await ensureAuthenticated(page, config)
          }
          /** @type {import('./types').StepContext} */
          const stepContext = { state, page, config, reporter, context }
          await step.run(stepContext)
          assertAdminNetworkBoundary(requestURLs, config.apiPath)
        }

        await runStepWithTimeout(step.id, run(), step.timeoutMs || stepTimeout)
        state.current = null
        state.failed = state.failed.filter((id) => id !== step.id)
        state.completed.push(step.id)
        stateLib.saveSync(state)
        console.log(`步骤 ${step.id} 完成`)
      } catch (err) {
        reporter.onStepFail(step.id, err.details || [], err.message)
        state.current = step.id
        state.failed.push(step.id)
        stateLib.saveSync(state)
        console.error(`步骤 ${step.id} 失败: ${err.message}`)
        stepFailed = true
        break
      } finally {
        await context.close()
      }
    }
  } finally {
    try { await browser.close() } catch {}
    await cleanup.restoreRegistered()
    cleanConfigLocal()
    if (hasPassword) {
      pm2Restart()
      // 恢复原始 config.local.js 后无密码，skip password probe
      await waitForHealth(config.apiBaseURL + '/health', 15, 1000, false)
    }
    reporter.finish(new Date())

    const summary = reporter.getSummary()
    console.log(`\n=== 验收完成 ===`)
    console.log(`通过: ${summary.passed} | 失败: ${summary.failed} | 跳过: ${summary.skipped} | 总计: ${summary.total}`)
    console.log(`报告: output/report.md`)
  }

  process.exit(stepFailed ? 1 : 0)
}

main()
