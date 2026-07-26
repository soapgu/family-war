import { test, expect } from '@playwright/test'
import { HomePage } from './pages/HomePage.js'
import { RoomPage } from './pages/RoomPage.js'
import { GameBoardPage } from './pages/GameBoardPage.js'

test.describe.serial('RPS 人 vs 机器人', () => {
  let ctx
  let page

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext()
    page = await ctx.newPage()
  })

  test.afterAll(async () => {
    await ctx.close()
  })

  test('01 - 进入房间并选择爸爸', async ({}) => {
    const home = new HomePage(page)
    const baseURL = test.info().project.use.baseURL
    await home.join('小明', baseURL)
    await expect(page.getByText('游戏房间')).toBeVisible()

    const room = new RoomPage(page)
    await room.selectRole('爸爸')
    await room.waitForRoleSelected()
  })

  test('02 - 挑战机器人', async ({}) => {
    const room = new RoomPage(page)
    await room.waitForChallengeButton()
    await room.clickChallenge('机器人')
    await expect(page.getByText('第 1 局')).toBeVisible()
  })

  test('03 - 循环出拳直到赛果', async ({}, testInfo) => {
    const board = new GameBoardPage(page)

    for (let i = 0; i < 20; i++) {
      const what = await Promise.race([
        page.getByRole('button', { name: '返回房间' }).waitFor({ state: 'visible' }).then(() => 'end'),
        board.makeChoice('石头').then(() => 'next'),
      ])
      if (what === 'end') break
    }

    await expect(page.getByRole('button', { name: '返回房间' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('rps-vs-robot.png') })
  })
})
