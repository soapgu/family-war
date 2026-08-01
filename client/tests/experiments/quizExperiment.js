import fs from 'node:fs/promises'
import path from 'node:path'
import { expect } from '@playwright/test'
import { HomePage } from '../e2e/pages/HomePage.js'
import { RoomPage } from '../e2e/pages/RoomPage.js'
import { ArithmeticBoardPage } from '../e2e/pages/ArithmeticBoardPage.js'
import { SpellingBoardPage } from '../e2e/pages/SpellingBoardPage.js'
import { MatchResultPage } from '../e2e/pages/MatchResultPage.js'

const ROBOT_LABEL = '机器人'
const BARRIER_LEAD_MS = 500

function installSpeechCapture() {
  const entries = []
  class ExperimentUtterance {
    constructor(text) {
      this.text = String(text || '')
      this.lang = ''
      this.rate = 1
      this.voice = null
      this.onend = null
      this.onerror = null
    }
  }
  const speechSynthesis = {
    getVoices: () => [{ name: 'Experiment English', lang: 'en-GB' }],
    addEventListener: () => {},
    removeEventListener: () => {},
    cancel: () => {},
    resume: () => {},
    speak: (utterance) => {
      entries.push({ text: String(utterance?.text || ''), capturedAt: Date.now() })
    },
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: ExperimentUtterance,
  })
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: speechSynthesis,
  })
  window.__quizExperimentSpeech = entries
}

async function captureFailure(page, testInfo, label) {
  const screenshotPath = testInfo.outputPath(`${label}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
  await testInfo.attach(`${label}-screenshot`, { path: screenshotPath, contentType: 'image/png' }).catch(() => {})
}

async function createMatchPlayers(browser, baseURL, testInfo, matchIndex) {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  await Promise.all([
    contextA.addInitScript(installSpeechCapture),
    contextB.addInitScript(installSpeechCapture),
  ])
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()
  const seed = `${process.pid}-${Date.now().toString(36)}-${matchIndex + 1}`
  const a = { page: pageA, context: contextA, nickname: `experiment-${seed}-A` }
  const b = { page: pageB, context: contextB, nickname: `experiment-${seed}-B` }

  try {
    await Promise.all([
      new HomePage(pageA).join(a.nickname, baseURL),
      new HomePage(pageB).join(b.nickname, baseURL),
    ])
    await Promise.all([
      new RoomPage(pageA).waitForRoomReady(),
      new RoomPage(pageB).waitForRoomReady(),
    ])
    return { a, b }
  } catch (error) {
    await Promise.all([
      captureFailure(pageA, testInfo, `match-${matchIndex + 1}-A`),
      captureFailure(pageB, testInfo, `match-${matchIndex + 1}-B`),
    ])
    await Promise.allSettled([contextA.close(), contextB.close()])
    throw error
  }
}

async function closeMatchPlayers(players) {
  const contexts = [players.a.context, players.b.context]
  await Promise.allSettled(contexts.map((context) => context.close()))
}

async function startQuizMatch(players, mode, matchIndex) {
  const roleA = matchIndex % 2 === 0 ? '爸爸' : '妈妈'
  const roleB = matchIndex % 2 === 0 ? '妈妈' : '爸爸'
  const roomA = new RoomPage(players.a.page)
  const roomB = new RoomPage(players.b.page)

  await roomA.selectRole(roleA)
  await roomA.waitForRoleStatus(roleA, '我')
  await roomB.selectRole(roleB)
  await roomB.waitForRoleStatus(roleB, '我')
  await roomA.switchToMode(mode)
  if (mode === 'spelling') await roomA.switchDifficulty('hard')
  await players.b.page.getByTestId('room-start-match-btn').waitFor({ state: 'visible' })
  await players.a.page.getByTestId('room-start-match-btn').click()

  if (mode === 'arithmetic') {
    const boardA = new ArithmeticBoardPage(players.a.page)
    const boardB = new ArithmeticBoardPage(players.b.page)
    await Promise.all([boardA.waitForQuestion(), boardB.waitForQuestion()])
    return { roleA, roleB, roomA, roomB, boardA, boardB }
  }

  const boardA = new SpellingBoardPage(players.a.page)
  const boardB = new SpellingBoardPage(players.b.page)
  await Promise.all([boardA.waitForQuestion(), boardB.waitForQuestion()])
  return { roleA, roleB, roomA, roomB, boardA, boardB }
}

async function getSpokenWord(page) {
  await page.waitForFunction(
    () => {
      const entries = window.__quizExperimentSpeech || []
      return entries.some((entry) => entry.text)
    },
    undefined,
    { timeout: 5000 }
  )
  return await page.evaluate(() => {
    const entries = window.__quizExperimentSpeech || []
    const word = [...entries].reverse().find((entry) => entry.text)?.text || ''
    entries.splice(0, entries.length)
    return word
  })
}

function missingLetters(blanks, answer) {
  let position = 0
  const result = []
  for (const token of blanks.split(' ')) {
    if (token === '_') {
      result.push(answer[position] || '')
      position += 1
    } else if (token === '·') {
      position += 1
    } else {
      position += token.length
    }
  }
  return result
}

async function prepareSpellingAnswer(board, word, correct) {
  const ariaLabel = await board.page.getByTestId('spelling-composer').getAttribute('aria-label')
  const blanks = String(ariaLabel || '').replace(/^填空\s*/, '')
  const letters = missingLetters(blanks, word)
  expect(letters.length, '默写题至少有一个缺失字母').toBeGreaterThan(0)
  const prepared = correct
    ? letters
    : letters.map((letter) => (letter.toLowerCase() === 'z' ? 'x' : 'z'))
  for (let index = 0; index < prepared.length - 1; index++) {
    await board.waitForInputReady(index)
    await board.fillLetter(index, prepared[index])
  }
  return {
    selector: `[data-testid="spelling-letter-input-${prepared.length - 1}"]`,
    value: prepared.at(-1),
    marker: ariaLabel,
  }
}

async function prepareArithmeticAnswer(board, correct) {
  const expression = await board.getExpression()
  const answer = ArithmeticBoardPage.parseAndEvaluate(expression)
  expect(Number.isFinite(answer), `无法解析算术表达式: ${expression}`).toBe(true)
  await board.fillAnswer(correct ? answer : answer + 1000)
  return {
    selector: '[data-testid="arithmetic-submit-btn"]',
    value: null,
    marker: expression,
  }
}

async function armPageAction(page, token, targetTime, action) {
  return await page.evaluate(({ token: actionToken, target, action: nextAction }) => {
    window.__quizExperimentActions ||= {}
    const armedAt = Date.now()
    const timerId = setTimeout(() => {
      const element = document.querySelector(nextAction.selector)
      if (!element) {
        window.__quizExperimentActions[actionToken] = {
          ...window.__quizExperimentActions[actionToken],
          firedAt: Date.now(),
          error: `找不到提交元素: ${nextAction.selector}`,
        }
        return
      }
      if (nextAction.value === null) {
        element.click()
      } else {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        setter?.call(element, nextAction.value)
        element.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          data: nextAction.value,
          inputType: 'insertText',
        }))
      }
      window.__quizExperimentActions[actionToken] = {
        ...window.__quizExperimentActions[actionToken],
        firedAt: Date.now(),
      }
    }, Math.max(0, target - armedAt))
    window.__quizExperimentActions[actionToken] = { armedAt, targetTime: target, timerId }
    return { armedAt, targetTime: target }
  }, { token, target: targetTime, action })
}

async function waitPageAction(page, token) {
  await page.waitForFunction(
    (actionToken) => !!window.__quizExperimentActions?.[actionToken]?.firedAt,
    token,
    { timeout: 3000 }
  )
  const result = await page.evaluate((actionToken) => {
    const { timerId, ...data } = window.__quizExperimentActions[actionToken]
    return data
  }, token)
  expect(result.error, '页面时间屏障执行失败').toBeUndefined()
  return result
}

async function submitAtBarrier(pageA, pageB, actionA, actionB, roundKey) {
  const targetTime = Date.now() + BARRIER_LEAD_MS
  const tokenA = `${roundKey}-A`
  const tokenB = `${roundKey}-B`
  const armed = await Promise.all([
    armPageAction(pageA, tokenA, targetTime, actionA),
    armPageAction(pageB, tokenB, targetTime, actionB),
  ])
  expect(Math.max(...armed.map((item) => item.armedAt)), '两个页面必须在目标时间前完成屏障装配')
    .toBeLessThan(targetTime - 100)
  const [resultA, resultB] = await Promise.all([
    waitPageAction(pageA, tokenA),
    waitPageAction(pageB, tokenB),
  ])
  return {
    targetTime,
    a: resultA,
    b: resultB,
    skewMs: Math.abs(resultA.firedAt - resultB.firedAt),
  }
}

async function getScoreSignature(page) {
  return await page.locator('.scoreboard-score').allTextContents().then((items) => items.join('|'))
}

async function waitForRoundAdvance(page, mode, previousScoreSignature) {
  const resultTestId = `${mode}-match-result`
  await page.waitForFunction(
    ({ resultTestId: id, previous }) => {
      if (document.querySelector(`[data-testid="${id}"]`)) return true
      const current = [...document.querySelectorAll('.scoreboard-score')]
        .map((element) => element.textContent)
        .join('|')
      const inputSelector = id.startsWith('arithmetic')
        ? '[data-testid="arithmetic-answer-input"]'
        : '[data-testid="spelling-letter-input-0"]'
      const input = document.querySelector(inputSelector)
      return current !== previous && !!input && !input.disabled
    },
    { resultTestId, previous: previousScoreSignature },
    { timeout: 10000 }
  )
}

function rankingMap(ranking, players) {
  const findScore = (text) => ranking.find((row) => row.text.includes(text))?.score ?? null
  return {
    A: findScore(players.a.nickname),
    B: findScore(players.b.nickname),
    robot: findScore(ROBOT_LABEL),
  }
}

function winnerFromScores(scores) {
  return Object.entries(scores).sort(([, left], [, right]) => right - left)[0][0]
}

async function collectResult(players, mode) {
  const resultA = new MatchResultPage(players.a.page, mode)
  const resultB = new MatchResultPage(players.b.page, mode)
  await Promise.all([resultA.waitForVisible(), resultB.waitForVisible()])
  const [rankingA, rankingB] = await Promise.all([resultA.getRanking(), resultB.getRanking()])
  const scoresA = rankingMap(rankingA, players)
  const scoresB = rankingMap(rankingB, players)
  expect(scoresA, 'A/B 浏览器的最终比分必须一致').toEqual(scoresB)
  const winner = winnerFromScores(scoresA)
  expect(scoresA[winner], '获胜者必须达到 5 分').toBe(5)
  return { resultA, resultB, scores: scoresA, winner }
}

async function runMatch({ browser, baseURL, testInfo, mode, strategy, matchIndex }) {
  const players = await createMatchPlayers(browser, baseURL, testInfo, matchIndex)
  try {
    const session = await startQuizMatch(players, mode, matchIndex)
    const barriers = []
    for (let round = 1; round <= 50; round++) {
      const previousScoreA = await getScoreSignature(players.a.page)
      const previousScoreB = await getScoreSignature(players.b.page)
      let actionA
      let actionB

      if (mode === 'arithmetic') {
        const [expressionA, expressionB] = await Promise.all([
          session.boardA.getExpression(),
          session.boardB.getExpression(),
        ])
        expect(expressionA, '双方必须看到同一道算术题').toBe(expressionB)
        ;[actionA, actionB] = await Promise.all([
          prepareArithmeticAnswer(session.boardA, strategy === 'fairness'),
          prepareArithmeticAnswer(session.boardB, strategy === 'fairness'),
        ])
      } else {
        const [wordA, wordB] = await Promise.all([
          getSpokenWord(players.a.page),
          getSpokenWord(players.b.page),
        ])
        expect(wordA, '双方必须听到同一个默写词').toBe(wordB)
        ;[actionA, actionB] = await Promise.all([
          prepareSpellingAnswer(session.boardA, wordA, strategy === 'fairness'),
          prepareSpellingAnswer(session.boardB, wordB, strategy === 'fairness'),
        ])
      }

      const barrier = await submitAtBarrier(
        players.a.page,
        players.b.page,
        actionA,
        actionB,
        `${mode}-${strategy}-${matchIndex + 1}-${round}`
      )
      barriers.push(barrier)

      if (strategy === 'passive') {
        if (mode === 'arithmetic') {
          await Promise.all([session.boardA.waitForFeedback(), session.boardB.waitForFeedback()])
        } else {
          await Promise.all([
            session.boardA.waitForAnsweredFeedback(),
            session.boardB.waitForAnsweredFeedback(),
          ])
        }
      }

      await Promise.all([
        waitForRoundAdvance(players.a.page, mode, previousScoreA),
        waitForRoundAdvance(players.b.page, mode, previousScoreB),
      ])
      if (await players.a.page.getByTestId(`${mode}-match-result`).count()) break
    }

    const result = await collectResult(players, mode)
    if (strategy === 'passive') {
      expect(result.scores, `${mode} 消极比赛必须是机器人 5:0:0`).toEqual({ A: 0, B: 0, robot: 5 })
      await Promise.all([result.resultA.clickReturnRoom(), result.resultB.clickReturnRoom()])
      await Promise.all([session.roomA.waitForRoomReady(), session.roomB.waitForRoomReady()])
    }

    return {
      mode,
      strategy,
      match: matchIndex + 1,
      roles: { A: session.roleA, B: session.roleB },
      scores: result.scores,
      winner: result.winner,
      rounds: Object.values(result.scores).reduce((sum, score) => sum + score, 0),
      barriers,
    }
  } catch (error) {
    await Promise.all([
      captureFailure(players.a.page, testInfo, `match-${matchIndex + 1}-A`),
      captureFailure(players.b.page, testInfo, `match-${matchIndex + 1}-B`),
    ])
    throw error
  } finally {
    await closeMatchPlayers(players)
  }
}

export async function runExperiment(params) {
  const count = params.strategy === 'fairness'
    ? Number.parseInt(process.env.EXPERIMENT_MATCH_COUNT || '10', 10)
    : 1
  const matches = []
  for (let matchIndex = 0; matchIndex < count; matchIndex++) {
    matches.push(await runMatch({ ...params, matchIndex }))
  }
  return { mode: params.mode, strategy: params.strategy, matches }
}

function percentage(value, total) {
  return total === 0 ? 0 : Number(((value / total) * 100).toFixed(1))
}

function summarizeExperiment(experiment) {
  const totals = { A: 0, B: 0, robot: 0 }
  const wins = { A: 0, B: 0, robot: 0 }
  const roleWins = { '爸爸': 0, '妈妈': 0, '机器人': 0 }
  const skews = []
  for (const match of experiment.matches) {
    wins[match.winner] += 1
    for (const key of Object.keys(totals)) totals[key] += match.scores[key]
    roleWins[match.winner === 'robot' ? '机器人' : match.roles[match.winner]] += 1
    skews.push(...match.barriers.map((barrier) => barrier.skewMs))
  }
  const humanRounds = totals.A + totals.B
  const warnings = []
  if (experiment.strategy === 'fairness') {
    for (const player of ['A', 'B']) {
      const matchRate = percentage(wins[player], experiment.matches.length)
      const roundRate = percentage(totals[player], humanRounds)
      if (matchRate < 30 || matchRate > 70) warnings.push(`${player} 比赛胜率 ${matchRate}% 超出 30%-70% 观察区间`)
      if (roundRate < 40 || roundRate > 60) warnings.push(`${player} 回合胜率 ${roundRate}% 超出 40%-60% 观察区间`)
    }
    if (wins.robot > 0) warnings.push(`机器人在公平竞争中获胜 ${wins.robot} 场`)
  }
  return {
    mode: experiment.mode,
    strategy: experiment.strategy,
    matchCount: experiment.matches.length,
    wins,
    matchRates: Object.fromEntries(Object.entries(wins).map(([key, value]) => [key, percentage(value, experiment.matches.length)])),
    roundWins: totals,
    humanRoundRates: { A: percentage(totals.A, humanRounds), B: percentage(totals.B, humanRounds) },
    roleWins,
    barrierSkewMs: {
      max: skews.length ? Math.max(...skews) : 0,
      average: skews.length ? Number((skews.reduce((sum, value) => sum + value, 0) / skews.length).toFixed(2)) : 0,
    },
    warnings,
  }
}

export async function writeExperimentReport(experiments, testInfo) {
  const summaries = experiments.map(summarizeExperiment)
  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      matchCount: Number.parseInt(process.env.EXPERIMENT_MATCH_COUNT || '10', 10),
      winningScore: 5,
      questionTimeLimitMs: 5000,
      robotAnswerDelayMs: 2500,
    },
    summaries,
    experiments,
  }
  const outputDir = path.resolve('tests/e2e/test-results/experiments')
  await fs.mkdir(outputDir, { recursive: true })
  const jsonPath = path.join(outputDir, 'quiz-experiment-report.json')
  const markdownPath = path.join(outputDir, 'quiz-experiment-report.md')
  const markdown = [
    '# Phase 1.5 答题比赛统计实验',
    '',
    `生成时间：${report.generatedAt}`,
    '',
    '|模式|策略|场数|A/B/机器人胜场|A/B/机器人回合|爸爸/妈妈/机器人胜场|屏障平均/最大偏差|警告|',
    '|---|---|---:|---|---|---|---|---|',
    ...summaries.map((item) => `|${item.mode}|${item.strategy}|${item.matchCount}|${item.wins.A}/${item.wins.B}/${item.wins.robot}|${item.roundWins.A}/${item.roundWins.B}/${item.roundWins.robot}|${item.roleWins['爸爸']}/${item.roleWins['妈妈']}/${item.roleWins['机器人']}|${item.barrierSkewMs.average}ms/${item.barrierSkewMs.max}ms|${item.warnings.join('；') || '无'}|`),
    '',
    '> 公平竞争的胜率区间只产生警告，不作为测试门禁。',
  ].join('\n')
  await Promise.all([
    fs.writeFile(jsonPath, JSON.stringify(report, null, 2)),
    fs.writeFile(markdownPath, markdown),
  ])
  for (const summary of summaries) {
    for (const warning of summary.warnings) {
      console.warn(`[experiment][${summary.mode}] ${warning}`)
    }
  }
  if (testInfo) {
    await testInfo.attach('quiz-experiment-report', { path: jsonPath, contentType: 'application/json' })
  }
  return { report, jsonPath, markdownPath }
}
