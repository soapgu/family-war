#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { chromium } = require('@playwright/test')
const config = require('./test-config')
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

const DEFAULT_STEP_TIMEOUT = 60000

class StepTimeoutError extends Error {
  constructor(id, ms) {
    super(`步骤 ${id} 超时 (${ms}ms)`)
    this.name = 'StepTimeoutError'
  }
}

function runStepWithTimeout(id, promise, ms) {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new StepTimeoutError(id, ms)), ms)
  })
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeoutPromise])
}

let sigintCount = 0

async function main() {
  const args = process.argv.slice(2)
  const onlyRestore = args.includes('--restore-only')
  const reset = args.includes('--reset')

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err)
    process.exit(1)
  })

  process.on('SIGINT', async () => {
    sigintCount++
    if (sigintCount === 1) {
      console.log('\n收到中断信号，正在执行恢复...')
      await cleanup.restoreRegistered()
      console.log('恢复完成，安全退出。再次 Ctrl+C 强制退出。')
      process.exit(130)
    } else {
      console.log('\n强制退出')
      process.exit(137)
    }
  })

  const stepTimeout = config.stepTimeoutOverride || DEFAULT_STEP_TIMEOUT

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

  let state
  if (!reset) {
    state = stateLib.load(config)
  }
  if (!state) {
    state = stateLib.defaultState()
    state.gitCommit = stateLib.getGitCommit()
    state.webBaseURL = config.webBaseURL
    state.apiBaseURL = config.apiBaseURL
    state.planVersion = 'Phase 6'
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

  // 加载步骤模块并过滤已完成步骤
  const steps = STEP_FILES.map((f) => {
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

      try {
        const run = async () => {
          if (step.requiresAuth) {
            await ensureAuthenticated(page, config)
          }
          const stepContext = { state, page, config, reporter, context }
          await step.run(stepContext)
        }

        await runStepWithTimeout(step.id, run(), stepTimeout)
        state.current = null
        state.failed = state.failed.filter((id) => id !== step.id)
        state.completed.push(step.id)
        stateLib.saveSync(state)
        console.log(`步骤 ${step.id} 完成`)
      } catch (err) {
        reporter.onStepFail(step.id, [], err.message)
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
    reporter.finish(new Date())

    const summary = reporter.getSummary()
    console.log(`\n=== 验收完成 ===`)
    console.log(`通过: ${summary.passed} | 失败: ${summary.failed} | 跳过: ${summary.skipped} | 总计: ${summary.total}`)
    console.log(`报告: output/report.md`)
  }

  process.exit(stepFailed ? 1 : 0)
}

main()
