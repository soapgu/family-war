import { expect } from '@playwright/test'
import { test, joinRoom } from './fixtures/index.js'
import { RoomPage } from './pages/RoomPage.js'
import { ArithmeticBoardPage } from './pages/ArithmeticBoardPage.js'
import { MatchResultPage } from './pages/MatchResultPage.js'

/**
 * 1k 算术完整比赛：解析表达式 → 正确/错误作答 → 验证反馈 → 比分推进 → 最终排名 → 返回房间。
 *
 * 服务端行为：5 分制，人类答对回合立结（机器人不参与该轮计分），
 * 人类答错则被锁定等机器人 20 秒后作答得分。
 *
 * 验证策略：
 * - 正确作答：因为 roundResult + question 在同一 tick 到达，React 批处理后
 *   feedback 元素从未渲染，通过 waitForNewQuestion 验证下一题到达（= 比分已更新）。
 * - 错误作答：feedback 在机器人回答前持续可见，直接验证 ❌ 错误文案。
 */
test('算术完整比赛：解析表达式、正确/错误作答、最终排名、返回房间', async ({ singlePlayer, baseURL }) => {
  const { page, nickname } = singlePlayer

  // ── 1. 进入房间、选角、切换算术模式、开始比赛 ────────────────
  await joinRoom(page, nickname, baseURL)
  const room = new RoomPage(page)
  await room.selectRole('爸爸')
  await room.waitForRoleSelected()
  await room.switchToMode('arithmetic')
  await page.getByTestId('room-start-match-btn').click()

  const board = new ArithmeticBoardPage(page)
  await board.waitForQuestion()

  // ── 2. Q1：正确作答 ── 验证新题到达（比分已更新）─────────────
  let expr = await board.getExpression()
  await board.submitCorrectAnswer()
  await board.waitForNewQuestion(expr)

  // ── 3. Q2：错误作答 ── 验证 ❌ 反馈 → 等机器人 20s → 新题 ──
  expr = await board.getExpression()
  const wrongAnswer = ArithmeticBoardPage.parseAndEvaluate(expr) + 100
  await board.fillAnswer(wrongAnswer)
  await board.submitAnswer()
  await board.waitForFeedback()
  expect(await board.isCorrect(), 'Q2 错误反馈').toBe(false)
  await board.waitForNewQuestion(expr)

  // ── 4. Q3–Q5：连对 3 题 ────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    expr = await board.getExpression()
    await board.submitCorrectAnswer()
    await board.waitForNewQuestion(expr)
  }

  // ── 5. Q6：第 5 分触发赛果 ──────────────────────────────────
  await board.submitCorrectAnswer()
  await board.waitForMatchResult()

  // ── 6. 验证赛果（标题 + 排名） ──────────────────────────────
  const matchResult = new MatchResultPage(page, 'arithmetic')
  await matchResult.waitForVisible()
  const title = await matchResult.getTitle()
  expect(title, '赛果标题含"恭喜"').toContain('恭喜')

  // 排名：玩家 5 分居首（含"我"标签），机器人未得分垫底
  const ranking = await matchResult.getRanking()
  expect(ranking.length, '排名包含所有玩家').toBeGreaterThanOrEqual(2)
  expect(ranking[0].score, '玩家 5 分取胜').toBe(5)
  expect(ranking[0].text, '第一名是玩家本人').toContain('我')

  // ── 7. 返回房间 ─────────────────────────────────────────────
  await matchResult.clickReturnRoom()
  await expect(page.getByText('游戏房间')).toBeVisible()
})
