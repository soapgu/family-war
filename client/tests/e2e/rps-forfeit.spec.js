import { expect } from '@playwright/test'
import { test, joinRoom } from './fixtures/index.js'
import { RoomPage } from './pages/RoomPage.js'
import { GameBoardPage } from './pages/GameBoardPage.js'

async function startRpsMatch(dualPlayers, baseURL) {
  const { a, b } = dualPlayers
  await joinRoom(a.page, a.nickname, baseURL)
  await joinRoom(b.page, b.nickname, baseURL)

  const roomA = new RoomPage(a.page)
  const roomB = new RoomPage(b.page)
  await roomA.selectRole('爸爸')
  await roomA.waitForRoleSelected()
  await roomB.selectRole('妈妈')
  await roomB.waitForRoleSelected()

  await roomA.waitForChallengeButton()
  await roomA.clickChallenge(b.nickname)

  const boardA = new GameBoardPage(a.page)
  const boardB = new GameBoardPage(b.page)
  await boardA.waitForChoosingPhase(1)
  await boardB.waitForChoosingPhase(1)

  return { roomA, roomB, boardA, boardB }
}

test('RPS 认输后双方返回房间并可重新发起比赛 @stable', { tag: '@stable' }, async ({ dualPlayers, baseURL }) => {
  const { a, b } = dualPlayers
  const { roomA, roomB, boardA, boardB } = await startRpsMatch(dualPlayers, baseURL)

  const opponentMessage = boardB.waitForForfeitMessage()
  await boardA.clickForfeit()

  await boardA.waitForGameBoardHidden()
  await opponentMessage
  await expect(b.page.getByTestId('rps-forfeit-message')).toHaveText('对手认输了')
  await boardB.waitForGameBoardHidden()

  await expect(a.page.getByTestId('rps-match-result')).toHaveCount(0)
  await expect(b.page.getByTestId('rps-match-result')).toHaveCount(0)
  await roomA.waitForChallengeButton()
  await roomB.waitForChallengeButton()

  await roomA.waitForRoleStatus('爸爸', '我')
  await roomA.waitForRoleStatus('妈妈', b.nickname)
  await roomB.waitForRoleStatus('爸爸', a.nickname)
  await roomB.waitForRoleStatus('妈妈', '我')

  await roomA.clickChallenge(b.nickname)
  await boardA.waitForChoosingPhase(1)
  await boardB.waitForChoosingPhase(1)
  expect(await boardA.getRoundTitle(), '爸爸视角新比赛轮次').toBe(1)
  expect(await boardB.getRoundTitle(), '妈妈视角新比赛轮次').toBe(1)
})
