import { expect } from '@playwright/test'
import { test, joinRoom } from './fixtures/index.js'
import { HomePage } from './pages/HomePage.js'
import { RoomPage } from './pages/RoomPage.js'

test('主动退出房间后其他玩家看到人数、玩家和角色同步释放', { tag: '@stable' }, async ({ dualPlayers, baseURL }) => {
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
  await roomA.waitForOnlineCount(2)
  await roomB.waitForOnlineCount(2)
  await roomB.waitForPlayerVisible(a.nickname)

  await roomA.clickLeave()

  await homeA.waitForReady()
  expect(await homeA.getNicknameValue(), '退出后首页昵称应清空').toBe('')
  await roomB.waitForOnlineCount(1)
  await roomB.waitForPlayerHidden(a.nickname)
  await roomB.waitForRoleStatus('爸爸', '空闲')
  await roomB.waitForRoleStatus('妈妈', '我')
})

test('最后玩家退出后重新进入得到无残留的干净房间', { tag: '@stable' }, async ({ singlePlayer, baseURL }) => {
  const { page, nickname } = singlePlayer
  await joinRoom(page, nickname, baseURL)

  const home = new HomePage(page)
  const room = new RoomPage(page)
  await room.selectRole('爸爸')
  await room.waitForRoleStatus('爸爸', '我')

  await room.clickLeave()
  await home.waitForReady()
  expect(await home.getNicknameValue(), '退出后首页昵称应清空').toBe('')

  await home.enterNickname(nickname)
  await home.clickEnter()
  await room.waitForRoomReady()

  await room.waitForOnlineCount(1)
  await room.waitForPlayerVisible(nickname)
  await room.waitForRoleStatus('爸爸', '空闲')
  await room.waitForRoleStatus('妈妈', '空闲')
  await room.waitForRoleStatus('儿子', '空闲')
  await expect(page.getByTestId('rps-game-board')).toHaveCount(0)
})
