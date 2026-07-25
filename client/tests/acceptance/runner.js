#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const CHECK_ONLY = process.argv.slice(2).includes('--check')
const RESET = process.argv.slice(2).includes('--reset')

const { chromium } = require('@playwright/test')
const config = CHECK_ONLY ? null : require('./test-config')
const reporterLib = require('./lib/reporter')

const STEPS_DIR = path.join(__dirname, 'steps')
const OUTPUT_DIR = path.join(__dirname, 'output')
const STEP_FILES = [
  '01-join-rooms.js',
  '02-select-roles.js',
  '03-challenge.js',
  '04-play-rps.js',
  '05-verify-result.js',
]

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

function checkSetup() {
  const missing = STEP_FILES
    .map(f => path.join(STEPS_DIR, f))
    .filter(p => !fs.existsSync(p))
  if (missing.length > 0) {
    throw new Error(`步骤文件缺失：\n${missing.join('\n')}`)
  }
  for (const file of STEP_FILES) {
    const step = require(path.join(STEPS_DIR, file))
    if (!step.id || typeof step.run !== 'function') {
      throw new Error(`步骤格式无效：${file}`)
    }
  }
  require.resolve('@playwright/test')
  console.log(`验收测试结构检查通过：${STEP_FILES.length} 个步骤`)
}

async function main() {
  if (CHECK_ONLY) {
    checkSetup()
    return
  }

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err)
    process.exit(1)
  })

  if (RESET) {
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
      console.log('已删除 output/ 目录')
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(config.screenshotDir, { recursive: true })

  const reporter = reporterLib.create(OUTPUT_DIR)

  const steps = STEP_FILES.map(f => ({ file: f, ...require(path.join(STEPS_DIR, f)) }))
  console.log(`待执行步骤: [${steps.map(s => s.id).join(', ')}]`)

  const browser = await chromium.launch({ headless: config.headless })

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  let stepFailed = false
  try {
    for (const step of steps) {
      if (stepFailed) {
        console.log(`跳过 ${step.id} (前置步骤失败)`)
        continue
      }

      console.log(`\n=== 执行步骤 ${step.id}: ${step.name} ===`)
      reporter.onStepStart(step.id, step.name)

      try {
        await runStepWithTimeout(
          step.id,
          step.run({ pageA, pageB, config, reporter }),
          step.timeoutMs || config.stepTimeout,
        )
        console.log(`步骤 ${step.id} 完成 ✓`)
      } catch (err) {
        reporter.onStepFail(step.id, [], err.message)
        console.error(`步骤 ${step.id} 失败: ${err.message}`)
        stepFailed = true
        break
      }
    }
  } finally {
    await ctxA.close()
    await ctxB.close()
    await browser.close().catch(() => {})
    reporter.finish()
    const summary = reporter.getSummary()
    console.log(`\n=== 验收完成 ===`)
    console.log(`通过: ${summary.passed} | 失败: ${summary.failed} | 总计: ${summary.total}`)
    console.log(`报告: output/report.md`)
  }

  process.exit(stepFailed ? 1 : 0)
}

main()
