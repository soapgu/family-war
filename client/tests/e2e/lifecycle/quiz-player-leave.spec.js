import { expect } from '@playwright/test'
import { test, joinRoom } from '../fixtures/index.js'
import { ArithmeticBoardPage } from '../pages/ArithmeticBoardPage.js'
import { HomePage } from '../pages/HomePage.js'
import { RoomPage } from '../pages/RoomPage.js'

test('LIFE-001：算术参赛者退出后剩余玩家结束旧对局并返回房间', { tag: '@stable' }, async ({ dualPlayers, baseURL }) => {
  const { a, b } = dualPlayers
  await joinRoom(a.page, a.nickname, baseURL)
  await joinRoom(b.page, b.nickname, baseURL)

  const homeA = new HomePage(a.page)
  const roomA = new RoomPage(a.page)
  const roomB = new RoomPage(b.page)
  await roomA.selectRole('爸爸')
  await roomA.waitForRoleStatus('爸爸', '我')
  await roomB.selectRole('妈妈')
  await roomB.waitForRoleStatus('妈妈', '我')
  await roomA.switchToMode('arithmetic')
  await expect(b.page.getByTestId('room-start-match-btn')).toBeVisible()
  await b.page.getByTestId('room-start-match-btn').click()

  const boardA = new ArithmeticBoardPage(a.page)
  const boardB = new ArithmeticBoardPage(b.page)
  await boardA.waitForQuestion()
  await boardB.waitForQuestion()

  await roomA.clickLeave()
  await homeA.waitForReady()
  await expect(b.page.getByTestId('arithmetic-expression')).toHaveCount(0, { timeout: 5000 })
  await expect(b.page.getByTestId('room-start-match-btn')).toBeVisible({ timeout: 5000 })
  await roomB.waitForOnlineCount(1)
  await roomB.waitForRoleStatus('爸爸', '空闲')
  await roomB.waitForRoleStatus('妈妈', '我')
})
