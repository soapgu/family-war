import { joinRoom } from '../fixtures/index.js'
import { GameBoardPage } from '../pages/GameBoardPage.js'
import { RoomPage } from '../pages/RoomPage.js'

/**
 * 建立爸爸对妈妈的双人 RPS 对局，并等待双方进入第 1 局可出拳状态。
 */
export async function startRpsMatch(dualPlayers, baseURL) {
  const { a, b } = dualPlayers
  await joinRoom(a.page, a.nickname, baseURL)
  await joinRoom(b.page, b.nickname, baseURL)

  const roomA = new RoomPage(a.page)
  const roomB = new RoomPage(b.page)
  await roomA.selectRole('爸爸')
  await roomA.waitForRoleStatus('爸爸', '我')
  await roomB.selectRole('妈妈')
  await roomB.waitForRoleStatus('妈妈', '我')
  await roomA.waitForChallengeButton(b.nickname)
  await roomA.clickChallenge(b.nickname)

  const boardA = new GameBoardPage(a.page)
  const boardB = new GameBoardPage(b.page)
  await boardA.waitForChoosingPhase(1)
  await boardB.waitForChoosingPhase(1)

  return { roomA, roomB, boardA, boardB }
}
