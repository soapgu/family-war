import { expect, test } from './socketClient.js'

test('LIFE-002：非参赛者不能认输并清理他人的 RPS 对局', { tag: '@lifecycle-issue' }, async ({ socketClients }) => {
  test.fail(true, 'LIFE-002：当前 game:forfeit 未验证发起者是否属于对局')

  const { connect, joinRoom, waitForEvent } = socketClients
  const [playerA, playerB, spectator] = await Promise.all([
    connect('playerA'),
    connect('playerB'),
    connect('spectator'),
  ])

  await joinRoom(playerA, 'e2e-lifecycle-player-a')
  await joinRoom(playerB, 'e2e-lifecycle-player-b')
  await joinRoom(spectator, 'e2e-lifecycle-spectator')

  let statePromise = waitForEvent(playerA, 'room:state')
  playerA.emit('role:select', { role: '爸爸' })
  await statePromise
  statePromise = waitForEvent(playerB, 'room:state')
  playerB.emit('role:select', { role: '妈妈' })
  await statePromise
  statePromise = waitForEvent(spectator, 'room:state')
  spectator.emit('role:select', { role: '儿子' })
  await statePromise

  const startA = waitForEvent(playerA, 'game:start')
  const startB = waitForEvent(playerB, 'game:start')
  playerA.emit('game:challenge', { targetId: playerB.id })
  await Promise.all([startA, startB])

  const spectatorError = waitForEvent(spectator, 'game:error')
  spectator.emit('game:forfeit')

  const error = await spectatorError
  expect(error.message).toBe('你不是本局玩家')

  const roundA = waitForEvent(playerA, 'game:roundResult')
  const roundB = waitForEvent(playerB, 'game:roundResult')
  playerA.emit('game:move', { choice: 'rock' })
  playerB.emit('game:move', { choice: 'scissors' })
  const [resultA, resultB] = await Promise.all([roundA, roundB])
  expect(resultA.round).toBe(1)
  expect(resultB.round).toBe(1)
})
