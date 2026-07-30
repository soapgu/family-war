import { expect } from '@playwright/test'
import { test, joinRoom } from './fixtures/index.js'
import { RoomPage } from './pages/RoomPage.js'
import { GameBoardPage } from './pages/GameBoardPage.js'
import { MatchResultPage } from './pages/MatchResultPage.js'

const DECIDING_ROUNDS = [
  { a: '石头', b: '剪刀' },
  { a: '石头', b: '布' },
  { a: '剪刀', b: '布' },
]

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

async function completeRpsMatch(boardA, boardB) {
  for (let index = 0; index < DECIDING_ROUNDS.length; index++) {
    const roundNumber = index + 1
    const round = DECIDING_ROUNDS[index]
    const isLast = index === DECIDING_ROUNDS.length - 1

    await boardA.waitForChoosingPhase(roundNumber)
    await boardB.waitForChoosingPhase(roundNumber)
    await boardA.makeChoice(round.a)
    await boardB.makeChoice(round.b)

    if (isLast) {
      await boardA.waitForMatchResult()
      await boardB.waitForMatchResult()
    } else {
      await boardA.waitForNewRound(roundNumber)
      await boardB.waitForNewRound(roundNumber)
    }
  }

  const resultA = new MatchResultPage(boardA.page, 'rps')
  const resultB = new MatchResultPage(boardB.page, 'rps')
  await resultA.waitForVisible()
  await resultB.waitForVisible()

  expect(await resultA.getRpsScore(), '爸爸视角终局比分').toEqual({ me: 2, opp: 1 })
  expect(await resultB.getRpsScore(), '妈妈视角终局比分').toEqual({ me: 1, opp: 2 })

  return { resultA, resultB }
}

test('RPS 赛后双方返回房间并保留角色', { tag: '@stable' }, async ({ dualPlayers, baseURL }) => {
  const { a, b } = dualPlayers
  const { roomA, roomB, boardA, boardB } = await startRpsMatch(dualPlayers, baseURL)
  const { resultA, resultB } = await completeRpsMatch(boardA, boardB)

  await resultA.clickReturnRoom()
  await resultB.clickReturnRoom()
  await resultA.waitForHidden()
  await resultB.waitForHidden()
  await roomA.waitForRoomReady()
  await roomB.waitForRoomReady()

  await roomA.waitForRoleStatus('爸爸', '我')
  await roomA.waitForRoleStatus('妈妈', b.nickname)
  await roomB.waitForRoleStatus('爸爸', a.nickname)
  await roomB.waitForRoleStatus('妈妈', '我')
  await roomA.waitForChallengeButton()
  await roomB.waitForChallengeButton()
})

test('RPS 一方发起重赛后双方从第 1 局和 0:0 重新开始', { tag: '@stable' }, async ({ dualPlayers, baseURL }) => {
  const { boardA, boardB } = await startRpsMatch(dualPlayers, baseURL)
  const { resultA, resultB } = await completeRpsMatch(boardA, boardB)

  await resultA.clickRematch()
  await boardA.waitForChoosingPhase(1)
  await boardB.waitForChoosingPhase(1)
  await resultA.waitForHidden()
  await resultB.waitForHidden()

  expect(await boardA.getRoundTitle(), '爸爸视角重赛轮次').toBe(1)
  expect(await boardB.getRoundTitle(), '妈妈视角重赛轮次').toBe(1)
  expect(await boardA.getScore(), '爸爸视角重赛初始比分').toEqual({ me: 0, opp: 0 })
  expect(await boardB.getScore(), '妈妈视角重赛初始比分').toEqual({ me: 0, opp: 0 })

  await boardA.makeChoice('石头')
  await boardB.makeChoice('剪刀')
  await boardA.waitForNewRound(1)
  await boardB.waitForNewRound(1)
  expect(await boardA.getScore(), '爸爸视角重赛首局比分').toEqual({ me: 1, opp: 0 })
  expect(await boardB.getScore(), '妈妈视角重赛首局比分').toEqual({ me: 0, opp: 1 })
})
