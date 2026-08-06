/**
 * v3.6 Phase 2 步骤 2c - 统一对局清理入口（lifecycle.cleanupGame）单元测试。
 *
 * 覆盖 docs/acceptance/v3.6/lifecycle-design.md 第 6 节六步契约：
 * - gameId 匹配：同步清机器人调度 + room.game
 * - gameId 不匹配 / room.game 已清：视为旧请求，整体 no-op（幂等 + 不误清新局）
 * - notify 策略：向仍在线真人参赛者各发一次通知，排除发起者与机器人
 */
const { Lifecycle } = require('../src/socket/lifecycle')

const ROBOT_ID = '__robot__'

function makeGame(players, id = 'g1', status = 'playing') {
  return { id, type: 'rps', players, status, scores: {}, roomId: 'default' }
}

function makePlayers(...ids) {
  return Object.fromEntries(
    ids.map((id) => [id, { id, nickname: id, online: true }])
  )
}

function makeRoom(game, playersObj) {
  return { id: 'default', game, players: playersObj, roles: {}, gameMode: 'rps' }
}

/** 构造 lifecycle 与 mock 依赖；roomManager.clearGame 真正置 room.game=null 以模拟真实清理 */
function setup(room) {
  const roomManager = {
    getRoom: jest.fn(() => room),
    clearGame: jest.fn(() => {
      room.game = null
    }),
  }
  const robotScheduler = { clear: jest.fn() }
  const emits = []
  const io = {
    to: jest.fn((target) => {
      const emit = jest.fn()
      emits.push({ target, emit })
      return { emit }
    }),
  }
  const lifecycle = new Lifecycle({
    io,
    roomManager,
    gameManager: {},
    robotScheduler,
    ROBOT_ID,
  })
  return { lifecycle, roomManager, robotScheduler, io, emits, room }
}

describe('lifecycle.cleanupGame - gameId 防护', () => {
  it('gameId 匹配时同步清除机器人调度和 room.game', () => {
    const game = makeGame(['socket-1', 'socket-2'])
    const { lifecycle, roomManager, robotScheduler, room } = setup(
      makeRoom(game, makePlayers('socket-1', 'socket-2'))
    )

    const result = lifecycle.cleanupGame('default', 'g1')

    expect(result).toEqual({ cleaned: true, stale: false, notified: [] })
    expect(robotScheduler.clear).toHaveBeenCalledWith('default')
    expect(roomManager.clearGame).toHaveBeenCalledWith('default')
    expect(room.game).toBeNull()
  })

  it('gameId 不匹配视为旧请求，不清不通知', () => {
    const game = makeGame(['socket-1', 'socket-2'])
    const { lifecycle, roomManager, robotScheduler, io, room } = setup(
      makeRoom(game, makePlayers('socket-1', 'socket-2'))
    )

    const result = lifecycle.cleanupGame('default', 'stale-game-id')

    expect(result).toEqual({ cleaned: false, stale: true, notified: [] })
    expect(robotScheduler.clear).not.toHaveBeenCalled()
    expect(roomManager.clearGame).not.toHaveBeenCalled()
    expect(io.to).not.toHaveBeenCalled()
    expect(room.game).toBe(game)
  })

  it('room.game 已为 null 时视为旧请求（重复清理幂等）', () => {
    const { lifecycle, roomManager, robotScheduler, io } = setup(
      makeRoom(null, makePlayers('socket-1'))
    )

    const result = lifecycle.cleanupGame('default', 'g1')

    expect(result).toEqual({ cleaned: false, stale: true, notified: [] })
    expect(robotScheduler.clear).not.toHaveBeenCalled()
    expect(roomManager.clearGame).not.toHaveBeenCalled()
    expect(io.to).not.toHaveBeenCalled()
  })

  it('同一 gameId 重复清理：第二次为 no-op，不重复通知', () => {
    const game = makeGame(['socket-1', 'socket-2'])
    const { lifecycle, roomManager, robotScheduler, io } = setup(
      makeRoom(game, makePlayers('socket-1', 'socket-2'))
    )
    const notify = { event: 'game:cancelled', message: '对手离开了房间', excludeSocketId: 'socket-1' }

    const first = lifecycle.cleanupGame('default', 'g1', { notify })
    expect(first.cleaned).toBe(true)
    expect(first.notified).toEqual(['socket-2'])

    jest.clearAllMocks()
    const second = lifecycle.cleanupGame('default', 'g1', { notify })

    expect(second).toEqual({ cleaned: false, stale: true, notified: [] })
    expect(robotScheduler.clear).not.toHaveBeenCalled()
    expect(roomManager.clearGame).not.toHaveBeenCalled()
    expect(io.to).not.toHaveBeenCalled()
  })

  it('旧 gameId 清理请求不误清新对局', () => {
    const newGame = makeGame(['socket-1', 'socket-2'], 'new-game')
    const { lifecycle, roomManager, robotScheduler, room } = setup(
      makeRoom(newGame, makePlayers('socket-1', 'socket-2'))
    )

    const result = lifecycle.cleanupGame('default', 'old-game')

    expect(result).toEqual({ cleaned: false, stale: true, notified: [] })
    expect(robotScheduler.clear).not.toHaveBeenCalled()
    expect(roomManager.clearGame).not.toHaveBeenCalled()
    expect(room.game).toBe(newGame)
  })
})

describe('lifecycle.cleanupGame - 通知对象筛选', () => {
  it('notify 策略向所有仍在线真人参赛者各发一次通知，排除发起者', () => {
    const game = makeGame(['socket-1', 'socket-2', 'socket-3'])
    const { lifecycle, emits } = setup(
      makeRoom(game, makePlayers('socket-1', 'socket-2', 'socket-3'))
    )

    const result = lifecycle.cleanupGame('default', 'g1', {
      notify: { event: 'game:cancelled', message: '对手离开了房间', excludeSocketId: 'socket-1' },
    })

    expect(result.notified).toEqual(['socket-2', 'socket-3'])
    const emit2 = emits.find((e) => e.target === 'socket-2').emit
    const emit3 = emits.find((e) => e.target === 'socket-3').emit
    expect(emit2).toHaveBeenCalledWith('game:cancelled', { message: '对手离开了房间' })
    expect(emit3).toHaveBeenCalledWith('game:cancelled', { message: '对手离开了房间' })
    expect(emits.find((e) => e.target === 'socket-1')).toBeUndefined()
  })

  it('机器人不接收取消通知', () => {
    const game = makeGame(['socket-1', ROBOT_ID])
    const { lifecycle, emits } = setup(makeRoom(game, makePlayers('socket-1', ROBOT_ID)))

    const result = lifecycle.cleanupGame('default', 'g1', {
      notify: { event: 'game:forfeited', message: '对手认输了', excludeSocketId: 'socket-1' },
    })

    expect(result.notified).toEqual([])
    expect(emits.find((e) => e.target === ROBOT_ID)).toBeUndefined()
  })

  it('notify 为 null 时不发送任何通知', () => {
    const game = makeGame(['socket-1', 'socket-2'])
    const { lifecycle, io } = setup(makeRoom(game, makePlayers('socket-1', 'socket-2')))

    const result = lifecycle.cleanupGame('default', 'g1', { notify: null })

    expect(result.notified).toEqual([])
    expect(io.to).not.toHaveBeenCalled()
  })

  it('通知对象已不在 room.players 时不通知该对象', () => {
    const game = makeGame(['socket-1', 'socket-2', 'socket-3'])
    // socket-3 已不在房间成员中（模拟已离开）
    const { lifecycle, emits } = setup(
      makeRoom(game, makePlayers('socket-1', 'socket-2'))
    )

    const result = lifecycle.cleanupGame('default', 'g1', {
      notify: { event: 'game:cancelled', message: '对手离开了房间', excludeSocketId: 'socket-1' },
    })

    expect(result.notified).toEqual(['socket-2'])
    expect(emits.find((e) => e.target === 'socket-2')).toBeDefined()
    expect(emits.find((e) => e.target === 'socket-3')).toBeUndefined()
  })
})
