import { expect } from '@playwright/test'
import { test, joinRoom } from './fixtures/index.js'
import { RoomPage } from './pages/RoomPage.js'
import { GameBoardPage } from './pages/GameBoardPage.js'

/**
 * 1h 完整版：单 test 自包含 + 3 局决胜（默认 2 胜制，2 胜即终局）。
 * 序列（爸爸胜/妈妈胜/爸爸胜 → 2-1 决胜，第 3 局后比赛结束）：
 *   局 1：爸爸石头 vs 妈妈剪刀 → 爸爸胜
 *   局 2：爸爸石头 vs 妈妈布   → 妈妈胜
 *   局 3：爸爸剪刀 vs 妈妈布   → 爸爸胜（2-1 决胜）
 *
 * 逐局验证：轮次标题 + 双方比分一致 + 赛果胜方/败方。
 * 等待条件用显式 expectedRound 参数，避免 dumpState 时序污染。
 */

const ROUNDS = [
  { a: '石头', b: '剪刀', desc: '第 1 局 爸爸石头 vs 妈妈剪刀 → 爸爸胜', expectMe: 1, expectOpp: 0 },
  { a: '石头', b: '布',   desc: '第 2 局 爸爸石头 vs 妈妈布 → 妈妈胜',   expectMe: 1, expectOpp: 1 },
  { a: '剪刀', b: '布',   desc: '第 3 局 爸爸剪刀 vs 妈妈布 → 爸爸胜（2-1 决胜）', expectMe: 2, expectOpp: 1 },
]

/**
 * @param {{ dualPlayers: import('./fixtures/index.js').DualPlayers, baseURL: string }} _
 * @param {import('@playwright/test').TestInfo} testInfo
 */
test('RPS 双人 2 胜制完整比赛（自包含 3 局决胜）', async ({ dualPlayers, baseURL }, testInfo) => {
  const { a, b } = dualPlayers

  // 1. 两人进入房间
  await joinRoom(a.page, a.nickname, baseURL)
  await joinRoom(b.page, b.nickname, baseURL)

  // 2. 选择角色
  const roomA = new RoomPage(a.page)
  const roomB = new RoomPage(b.page)
  await roomA.selectRole('爸爸')
  await roomA.waitForRoleSelected()
  await roomB.selectRole('妈妈')
  await roomB.waitForRoleSelected()

  // 3. 爸爸发起挑战
  await roomA.waitForChallengeButton()
  await roomA.clickChallenge(b.nickname)
  await expect(a.page.getByText('第 1 局')).toBeVisible()
  await expect(b.page.getByText('第 1 局')).toBeVisible()

  // 4. 3 局决胜（逐局验证）
  const boardA = new GameBoardPage(a.page)
  const boardB = new GameBoardPage(b.page)
  for (let i = 0; i < ROUNDS.length; i++) {
    const round = ROUNDS[i]
    const isLast = i === ROUNDS.length - 1

    // 4a. 双方都进入第 i+1 局 choosing 阶段（轮次标题 + 按钮双信号）
    await boardA.waitForChoosingPhase(i + 1)
    await boardB.waitForChoosingPhase(i + 1)

    // 4b. 验证轮次
    expect(await boardA.getRoundTitle(), `第 ${i + 1} 局 pageA 轮次`).toBe(i + 1)
    expect(await boardB.getRoundTitle(), `第 ${i + 1} 局 pageB 轮次`).toBe(i + 1)

    // 4c. 出拳（带 socket emit 同步）
    await boardA.makeChoice(round.a)
    await boardB.makeChoice(round.b)

    // 4d. 等本局结果
    if (isLast) {
      await boardA.waitForMatchResult()
      await boardB.waitForMatchResult()
    } else {
      await boardA.waitForNewRound(i + 1)
      await boardB.waitForNewRound(i + 1)
      // 4e. 验证中间局比分（双方一致）
      const scoreA = await boardA.getScore()
      const scoreB = await boardB.getScore()
      expect(scoreA.me, `第 ${i + 1} 局后 pageA 自身得分`).toBe(round.expectMe)
      expect(scoreA.opp, `第 ${i + 1} 局后 pageA 对手得分`).toBe(round.expectOpp)
      expect(scoreB.me, `第 ${i + 1} 局后 pageB 自身得分（与 pageA 对手一致）`).toBe(round.expectOpp)
      expect(scoreB.opp, `第 ${i + 1} 局后 pageB 对手得分（与 pageA 自身一致）`).toBe(round.expectMe)
    }
  }

  // 5. 验证胜方和败方赛果
  const titleA = await boardA.getMatchResultTitle()
  const titleB = await boardB.getMatchResultTitle()
  expect(titleA, 'pageA 胜方赛果').toContain('恭喜你获得比赛胜利！')
  expect(titleB, 'pageB 败方赛果').toContain('比赛结束，下次加油！')

  // 6. 终局比分
  const finalA = await boardA.getScore()
  const finalB = await boardB.getScore()
  expect(finalA.me, 'pageA 最终得分').toBe(2)
  expect(finalA.opp, 'pageA 对手最终得分').toBe(1)
  expect(finalB.me, 'pageB 最终得分').toBe(1)
  expect(finalB.opp, 'pageB 对手最终得分').toBe(2)

  await a.page.screenshot({ path: testInfo.outputPath('rps-match-result.png') })
})
