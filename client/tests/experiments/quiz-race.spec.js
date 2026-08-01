import { test } from '@playwright/test'
import { runExperiment, writeExperimentReport } from './quizExperiment.js'

const experimentResults = []

test.describe.configure({ mode: 'serial' })

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

test.afterAll(async ({}, testInfo) => {
  if (experimentResults.length > 0) await writeExperimentReport(experimentResults, testInfo)
})
