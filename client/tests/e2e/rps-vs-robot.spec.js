import { expect } from '@playwright/test'
import { test, joinRoom } from './fixtures/index.js'
import { RoomPage } from './pages/RoomPage.js'
import { GameBoardPage } from './pages/GameBoardPage.js'

/**
 * 1i 重写版：循环直到 pageA 或机器人达到 2 胜。
 *
 * 设计原则：
 * - 不预设胜负（机器人随机出拳）
 * - 不限 3 局（2 胜制下可能 2-10 局；pageA 出固定序列最大化胜负概率）
 * - 不依赖 describe.serial + beforeAll 共享状态
 * - 不依赖盲点循环（旧版 Promise.race + 最多 20 次）
 * - 兜底：MAX_ROUNDS 局后仍未达到 2 胜 → 失败（说明一直平局，配置问题）
 */

const PAGE_CHOICE_CYCLE = ['石头', '剪刀', '布']
const MAX_ROUNDS = 10
const WINNING_SCORE = 2

/**
 * @param {{ singlePlayer: import('./fixtures/index.js').PlayerHandle, baseURL: string }} _
 * @param {import('@playwright/test').TestInfo} testInfo
 */
test('RPS 人机 2 胜制完整比赛（循环直到 2 胜）', async ({ singlePlayer, baseURL }, testInfo) => {
  const { page, nickname } = singlePlayer

  // 1. 进入房间并选角色
  await joinRoom(page, nickname, baseURL)

  const room = new RoomPage(page)
  await room.selectRole('爸爸')
  await room.waitForRoleSelected()

  // 2. 挑战机器人
  await room.waitForChallengeButton()
  await room.clickChallenge('机器人')
  await expect(page.getByText('第 1 局')).toBeVisible()

  // 3. 循环直到某方达到 2 胜（或 MAX_ROUNDS 兜底）
  const board = new GameBoardPage(page)
  let pageAWins = 0
  let robotWins = 0
  let matchEnded = false

  for (let i = 0; i < MAX_ROUNDS; i++) {
    // 3a 进入第 i+1 局 choosing
    await board.waitForChoosingPhase(i + 1)

    // 3b 验证轮次
    expect(await board.getRoundTitle(), `第 ${i + 1} 局轮次`).toBe(i + 1)

    // 3c pageA 出拳（固定序列循环 3 种拳，最大化胜负概率）
    await board.makeChoice(PAGE_CHOICE_CYCLE[i % 3])

    // 3d 等本局结果（机器人自动出拳 → 下一局 OR 赛果）
    await board.waitForRoundOrMatch(i + 1)

    // 3e 验证比分推进（每局总增分 ≤ i+1）
    const score = await board.getScore()
    expect(score.me + score.opp, `第 ${i + 1} 局后总得分`).toBeLessThanOrEqual(i + 1)
    pageAWins = score.me
    robotWins = score.opp

    // 3f 检查赛果
    const matchPanel = await page.getByTestId('rps-match-result').count()
    if (matchPanel > 0) {
      matchEnded = true
      break
    }
  }

  // 4. 兜底检查
  expect(matchEnded, `${MAX_ROUNDS} 局内必有一方达到 2 胜（pageA=${pageAWins} 机器人=${robotWins}）`).toBe(true)

  // 5. 验证赛果
  const title = await board.getMatchResultTitle()
  const finalScore = await board.getScore()
  const pageAWon = finalScore.me === WINNING_SCORE
  const robotWon = finalScore.opp === WINNING_SCORE
  expect(pageAWon || robotWon, '必有一方达到 2 胜').toBe(true)
  if (pageAWon) {
    expect(title, 'pageA 胜方赛果').toContain('恭喜你获得比赛胜利！')
  } else {
    expect(title, 'pageA 败方赛果').toContain('比赛结束，下次加油！')
  }

  await page.screenshot({ path: testInfo.outputPath('rps-vs-robot.png') })
})
