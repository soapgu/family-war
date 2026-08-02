import { test } from '@playwright/test'
import { runExperiment, writeExperimentReport } from './quizExperiment.js'

// 收集当前命令实际执行到的实验结果：使用 --grep 时，报告只包含被选中的实验组。
const experimentResults = []

// 所有实验共用服务端的 default 房间，必须串行执行，避免不同模式和玩家互相干扰。
// 每场比赛内部仍会创建全新的 A/B Browser Context，不复用上一场的页面状态。
test.describe.configure({ mode: 'serial' })

// 公平竞争默认各跑 10 场；可通过 EXPERIMENT_MATCH_COUNT 调整。
test('fairness arithmetic：A/B 同时正确作答统计', async ({ browser, baseURL }, testInfo) => {
  experimentResults.push(await runExperiment({
    browser,
    baseURL,
    testInfo,
    mode: 'arithmetic',
    strategy: 'fairness',
  }))
})

test('fairness spelling：A/B 同时正确作答统计', async ({ browser, baseURL }, testInfo) => {
  experimentResults.push(await runExperiment({
    browser,
    baseURL,
    testInfo,
    mode: 'spelling',
    strategy: 'fairness',
  }))
})

// 消极比赛固定各跑 1 场，不受 EXPERIMENT_MATCH_COUNT 影响。
test('passive arithmetic：A/B 全部答错后机器人 5:0:0', async ({ browser, baseURL }, testInfo) => {
  experimentResults.push(await runExperiment({
    browser,
    baseURL,
    testInfo,
    mode: 'arithmetic',
    strategy: 'passive',
  }))
})

test('passive spelling：A/B 全部答错后机器人 5:0:0', async ({ browser, baseURL }, testInfo) => {
  experimentResults.push(await runExperiment({
    browser,
    baseURL,
    testInfo,
    mode: 'spelling',
    strategy: 'passive',
  }))
})

// 把本次命令收集到的实验统一输出为 JSON 明细和 Markdown 汇总。
// 自动报告位于 Git 忽略目录，后续运行会覆盖上一份。
test.afterAll(async ({}, testInfo) => {
  if (experimentResults.length > 0) await writeExperimentReport(experimentResults, testInfo)
})
