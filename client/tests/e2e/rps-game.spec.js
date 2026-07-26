import { test, expect } from '@playwright/test'
import { HomePage } from './pages/HomePage.js'
import { RoomPage } from './pages/RoomPage.js'
import { GameBoardPage } from './pages/GameBoardPage.js'

const ROUNDS = [
  { a: '石头', b: '剪刀', desc: '爸爸石头 vs 妈妈剪刀 → 爸爸胜' },
  { a: '石头', b: '布', desc: '爸爸石头 vs 妈妈布 → 妈妈胜' },
  { a: '石头', b: '石头', desc: '爸爸石头 vs 妈妈石头 → 平局' },
  { a: '剪刀', b: '布', desc: '爸爸剪刀 vs 妈妈布 → 爸爸胜' },
]

test.describe.serial('RPS 双人对战', () => {
  let ctxA
  let ctxB
  let pageA
  let pageB

  test.beforeAll(async ({ browser }) => {
    ctxA = await browser.newContext()
    ctxB = await browser.newContext()
    pageA = await ctxA.newPage()
    pageB = await ctxB.newPage()
  })

  test.afterAll(async () => {
    await ctxA.close()
    await ctxB.close()
  })

  test('01 - 两人进入房间', async ({}) => {
    const homeA = new HomePage(pageA)
    const homeB = new HomePage(pageB)
    const baseURL = test.info().project.use.baseURL

    await homeA.join('小明', baseURL)
    await expect(pageA.getByText('游戏房间')).toBeVisible()

    await homeB.join('小红', baseURL)
    await expect(pageB.getByText('游戏房间')).toBeVisible()
  })

  test('02 - 选择角色：爸爸 vs 妈妈', async ({}) => {
    const roomA = new RoomPage(pageA)
    const roomB = new RoomPage(pageB)

    await roomA.selectRole('爸爸')
    await roomA.waitForRoleSelected()

    await roomB.selectRole('妈妈')
    await roomB.waitForRoleSelected()
  })

  test('03 - 爸爸发起挑战', async ({}) => {
    const roomA = new RoomPage(pageA)
    const roomB = new RoomPage(pageB)

    await roomA.waitForChallengeButton()
    await roomA.clickChallenge('小红')

    await expect(pageA.getByText('第 1 局')).toBeVisible()
    await expect(pageB.getByText('第 1 局')).toBeVisible()
  })

  test('04 - 完成 4 局对战', async ({}) => {
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
  })

  test('05 - 验证赛果', async ({}, testInfo) => {
    await expect(pageA.getByText('恭喜你获得比赛胜利！')).toBeVisible()
    await expect(pageB.getByText('比赛结束，下次加油！')).toBeVisible()
    await pageA.screenshot({ path: testInfo.outputPath('rps-match-result.png') })
  })
})
