import { expect } from '@playwright/test'
import { test, joinRoom } from '../fixtures/index.js'
import { GameBoardPage } from '../pages/GameBoardPage.js'
import { RoomPage } from '../pages/RoomPage.js'

async function startRpsMatch(dualPlayers, baseURL) {
  const { a, b } = dualPlayers
  await joinRoom(a.page, a.nickname, baseURL)
  await joinRoom(b.page, b.nickname, baseURL)

  const roomA = new RoomPage(a.page)
  const roomB = new RoomPage(b.page)
  await roomA.selectRole('爸爸')
  await roomA.waitForRoleStatus('爸爸', '我')
  await roomB.selectRole('妈妈')
  await roomB.waitForRoleStatus('妈妈', '我')
  await roomA.clickChallenge(b.nickname)

  const boardA = new GameBoardPage(a.page)
  const boardB = new GameBoardPage(b.page)
  await boardA.waitForChoosingPhase(1)
  await boardB.waitForChoosingPhase(1)
  return { roomA, roomB, boardA }
}

test('RPS 参赛者断线后取消比赛，恢复网络后以无角色状态重入房间', { tag: '@lifecycle-issue' }, async ({ dualPlayers, baseURL }) => {
  test.setTimeout(120000)

  const { a, b } = dualPlayers
  const { roomA, roomB, boardA } = await startRpsMatch(dualPlayers, baseURL)

  await a.ctx.setOffline(true)
  // Socket.IO 需要等待 ping interval + ping timeout 才会把网络离线识别为 disconnect。
  await expect(b.page.getByTestId('rps-game-board')).toBeHidden({ timeout: 60000 })
  await roomB.waitForOnlineCount(1)
  await roomB.waitForPlayerHidden(a.nickname)
  await roomB.waitForRoleStatus('爸爸', '空闲')
  await roomB.waitForRoleStatus('妈妈', '我')

  await a.ctx.setOffline(false)
  await roomA.waitForOnlineCount(2)
  await roomB.waitForOnlineCount(2)
  await roomA.waitForPlayerVisible(a.nickname)
  await roomB.waitForPlayerVisible(a.nickname)
  await boardA.waitForGameBoardHidden()
  await roomA.waitForRoleStatus('爸爸', '空闲')
  await roomA.waitForRoleStatus('妈妈', b.nickname)
  await expect(a.page.getByText('选择一个角色加入游戏')).toBeVisible()
})
