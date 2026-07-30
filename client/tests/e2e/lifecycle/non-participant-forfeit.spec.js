import { expect, test } from '@playwright/test'
import {
  closeSockets,
  connectSocket,
  joinSocketRoom,
  waitForSocketEvent,
} from './socketClient.js'

test('LIFE-002：非参赛者不能认输并清理他人的 RPS 对局', { tag: '@lifecycle-issue' }, async () => {
  test.fail(true, 'LIFE-002：当前 game:forfeit 未验证发起者是否属于对局')

  const sockets = []
  try {
    const [playerA, playerB, spectator] = await Promise.all([
      connectSocket(),
      connectSocket(),
      connectSocket(),
    ])
    sockets.push(playerA, playerB, spectator)

    await joinSocketRoom(playerA, 'e2e-lifecycle-player-a')
    await joinSocketRoom(playerB, 'e2e-lifecycle-player-b')
    await joinSocketRoom(spectator, 'e2e-lifecycle-spectator')

    let statePromise = waitForSocketEvent(playerA, 'room:state')
    playerA.emit('role:select', { role: '爸爸' })
    await statePromise
    statePromise = waitForSocketEvent(playerB, 'room:state')
    playerB.emit('role:select', { role: '妈妈' })
    await statePromise
    statePromise = waitForSocketEvent(spectator, 'room:state')
    spectator.emit('role:select', { role: '儿子' })
    await statePromise

    const startA = waitForSocketEvent(playerA, 'game:start')
    const startB = waitForSocketEvent(playerB, 'game:start')
    playerA.emit('game:challenge', { targetId: playerB.id })
    await Promise.all([startA, startB])

    const spectatorError = waitForSocketEvent(spectator, 'game:error')
    spectator.emit('game:forfeit')

    const error = await spectatorError
    expect(error.message).toBe('你不是本局玩家')

    const roundA = waitForSocketEvent(playerA, 'game:roundResult')
    const roundB = waitForSocketEvent(playerB, 'game:roundResult')
    playerA.emit('game:move', { choice: 'rock' })
    playerB.emit('game:move', { choice: 'scissors' })
    const [resultA, resultB] = await Promise.all([roundA, roundB])
    expect(resultA.round).toBe(1)
    expect(resultB.round).toBe(1)
  } finally {
    closeSockets(sockets)
  }
})
