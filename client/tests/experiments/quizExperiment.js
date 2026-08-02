import fs from 'node:fs/promises'
import path from 'node:path'
import { expect } from '@playwright/test'
import { HomePage } from '../e2e/pages/HomePage.js'
import { RoomPage } from '../e2e/pages/RoomPage.js'
import { ArithmeticBoardPage } from '../e2e/pages/ArithmeticBoardPage.js'
import { SpellingBoardPage } from '../e2e/pages/SpellingBoardPage.js'
import { MatchResultPage } from '../e2e/pages/MatchResultPage.js'

const ROBOT_LABEL = '机器人'
// 给两个页面预留安装定时动作的时间；装配不足 100ms 余量时视为屏障失效。
const BARRIER_LEAD_MS = 500

/**
 * 在页面业务脚本执行前替换 Web Speech API，记录用户原本可以听到的 TTS 文本。
 * 该捕获只存在于实验 Context，不读取 Socket Payload、服务端内存或隐藏应用状态。
 */
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

/** 失败时尽力保存页面截图；诊断失败不得覆盖真正的测试错误。 */
async function captureFailure(page, testInfo, label) {
  const screenshotPath = testInfo.outputPath(`${label}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
  await testInfo.attach(`${label}-screenshot`, { path: screenshotPath, contentType: 'image/png' }).catch(() => {})
}

/**
 * 为单场比赛创建完全隔离的 A/B Context、页面、Socket.IO 连接和唯一昵称。
 * 如果进房失败，先为双方留存截图，再关闭已经创建的 Context。
 */
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

/** 同时清理双方 Context；一方关闭失败不能阻止另一方继续清理。 */
async function closeMatchPlayers(players) {
  const contexts = [players.a.context, players.b.context]
  await Promise.allSettled(contexts.map((context) => context.close()))
}

/**
 * 逐场交换爸爸/妈妈角色，设置答题模式并开始比赛。
 * 默写固定使用 hard 难度，随后等待双方都拿到第一题。
 */
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

/**
 * 读取当前题最后一次公开朗读的文本，并原地清空捕获数组，避免下一题读到旧数据。
 */
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

/**
 * 根据页面 aria-label 中的填空结构，从完整 TTS 答案提取所有缺失字母。
 * “_”表示输入框，“·”及已显示文本只推进完整答案的位置。
 */
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

/**
 * 准备默写答案，但保留最后一个字母给时间屏障触发正式自动提交。
 * 消极策略使用 z/x 替换，确保每一个缺失字母都与正确答案不同。
 */
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

/**
 * 使用安全表达式解析器准备算术答案；消极策略在正确答案上加 1000。
 * 此处只填答案，正式点击由两个页面的共同时间屏障完成。
 */
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

/**
 * 在单个浏览器页面的事件循环中安装绝对目标时间动作。
 * value 为 null 时点击按钮，否则用原生 input setter 和 InputEvent 模拟真实输入。
 */
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

/** 等待页面动作触发并返回 armedAt/targetTime/firedAt；DOM 操作失败属于硬失败。 */
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

/**
 * 把同一个未来目标时间下发给两个独立页面，并等待双方各自在页面内触发。
 * 返回的 skewMs 是 A/B 实际触发时间之差，而不是 Playwright 命令发送时间之差。
 */
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

/** 把当前计分板压缩成可比较签名，用于观察服务端是否已结算本轮。 */
async function getScoreSignature(page) {
  return await page.locator('.scoreboard-score').allTextContents().then((items) => items.join('|'))
}

/**
 * 等待比赛进入赛果页，或等待比分变化且下一题输入重新可用。
 * 使用用户可观察状态代替固定时长等待。
 */
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

/** 把包含动态昵称的赛果排名转换为稳定的 A/B/robot 分数结构。 */
function rankingMap(ranking, players) {
  const findScore = (text) => ranking.find((row) => row.text.includes(text))?.score ?? null
  return {
    A: findScore(players.a.nickname),
    B: findScore(players.b.nickname),
    robot: findScore(ROBOT_LABEL),
  }
}

/** 按最终分数确定 A、B 或 robot 胜者；正常 5 分制终局不会并列第一。 */
function winnerFromScores(scores) {
  return Object.entries(scores).sort(([, left], [, right]) => right - left)[0][0]
}

/**
 * 交叉读取双方赛果页，硬断言最终排名一致且第一名达到实验 Profile 的 5 分。
 */
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

/**
 * 执行一场完整答题比赛：建房、准备答案、同步提交、逐轮结算并收集赛果。
 * 50 轮是防止异常状态无限循环的安全上限；无论成功失败都会关闭双方 Context。
 */
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
        // 双方分别捕获自己的公开 TTS，并先确认收到的是同一个单词。
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
        // 先确认 A/B 的错误答案已被正式处理，再等待机器人调度得分。
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
      // 消极比赛是确定性规则验证，比分和返回房间能力均属于硬断言。
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

/**
 * 执行一个“模式 × 策略”实验组。公平竞争默认串行 10 场，消极比赛固定 1 场。
 * 单场不能并行，因为项目当前所有真人玩家都进入同一个 default 房间。
 */
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

/** 计算保留一位小数的百分比；空样本返回 0。 */
function percentage(value, total) {
  return total === 0 ? 0 : Number(((value / total) * 100).toFixed(1))
}

/**
 * 将逐场数据汇总为 Browser、角色、机器人、累计回合和屏障偏差统计。
 * 公平比例超出观察区间只生成 warning；流程和赛果一致性已在 runMatch 中硬断言。
 */
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

/**
 * 输出本次运行的完整 JSON 和便于阅读的 Markdown 汇总，并附加 JSON 到 Playwright 报告。
 * 文件使用固定名称，因此 test-results 中只保留最新一次；长期数据需另行归档到 docs。
 */
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
