import { test, expect } from '@playwright/test'
import { HomePage } from './pages/HomePage.js'
import { RoomPage } from './pages/RoomPage.js'
import { GameBoardPage } from './pages/GameBoardPage.js'

/**
 * 1c 试验：单 test 自包含 + 3 局决胜（验证 webServer 装配可用）。
 * 1h 完整任务会进一步精确化"逐局验证轮次与比分"等断言。
 *
 * 序列（默认 2 胜制，2 胜即终局，本序列在第 3 局结束）：
 *   局 1：爸爸石头 vs 妈妈剪刀 → 爸爸胜（1-0）
 *   局 2：爸爸布   vs 妈妈石头 → 妈妈胜（1-1）
 *   局 3：爸爸剪刀 vs 妈妈布   → 爸爸胜（2-1）→ 爸爸胜出
 */
const ROUNDS = [
  { a: '石头', b: '剪刀', desc: '第 1 局 爸爸石头 vs 妈妈剪刀 → 爸爸胜' },
  { a: '布', b: '石头', desc: '第 2 局 爸爸布 vs 妈妈石头 → 妈妈胜' },
  { a: '剪刀', b: '布', desc: '第 3 局 爸爸剪刀 vs 妈妈布 → 爸爸胜（2-1 决胜）' },
]

test('RPS 双人 2 胜制完整比赛（自包含 3 局决胜）', async ({ browser }, testInfo) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()
  const baseURL = test.info().project.use.baseURL

  try {
    // 1. 两人进入房间
    const homeA = new HomePage(pageA)
    const homeB = new HomePage(pageB)
    await homeA.join('小明', baseURL)
    await expect(pageA.getByText('游戏房间')).toBeVisible()
    await homeB.join('小红', baseURL)
    await expect(pageB.getByText('游戏房间')).toBeVisible()

    // 2. 选择角色
    const roomA = new RoomPage(pageA)
    const roomB = new RoomPage(pageB)
    await roomA.selectRole('爸爸')
    await roomA.waitForRoleSelected()
    await roomB.selectRole('妈妈')
    await roomB.waitForRoleSelected()

    // 3. 爸爸发起挑战
    await roomA.waitForChallengeButton()
    await roomA.clickChallenge('小红')
    await expect(pageA.getByText('第 1 局')).toBeVisible()
    await expect(pageB.getByText('第 1 局')).toBeVisible()

    // 4. 3 局决胜
    const boardA = new GameBoardPage(pageA)
    const boardB = new GameBoardPage(pageB)
    for (let i = 0; i < ROUNDS.length; i++) {
      const round = ROUNDS[i]
      const isLast = i === ROUNDS.length - 1
      await boardA.waitForChoosingPhase()
      await boardB.waitForChoosingPhase()
      await boardA.makeChoice(round.a)
      await boardB.makeChoice(round.b)
      if (isLast) {
        await boardA.waitForMatchResult()
        await boardB.waitForMatchResult()
      } else {
        await boardA.waitForRoundResult()
        await boardB.waitForRoundResult()
      }
    }

    // 5. 验证胜方和败方赛果
    await expect(pageA.getByText('恭喜你获得比赛胜利！')).toBeVisible()
    await expect(pageB.getByText('比赛结束，下次加油！')).toBeVisible()
    await pageA.screenshot({ path: testInfo.outputPath('rps-match-result.png') })
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})
