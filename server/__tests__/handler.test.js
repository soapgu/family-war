/**
 * v3.1 Phase 1 重构 — handler.js 边界条件单元测试。
 *
 * 通过 mock roomManager / gameManager / robotScheduler 验证 handler 的 3 个审查修复：
 * 1. room:leave → leaveRoom 返回 null 时调用 robotScheduler.clear
 * 2. disconnect → handleDisconnect 返回 null 时调用 robotScheduler.clear
 * 3. game:rematch → 非 RPS 模式拒绝 / RPS 允许 / game 不存在返回 error
 * 4. game:answer → 数字/对象类型默写答案被拒绝
 */
const registerHandlers = require('../src/socket/handler')

jest.mock('../src/socket/roomManager')
jest.mock('../src/socket/gameManager')
jest.mock('../src/socket/robotScheduler')
jest.mock('../src/logger', () => ({
  info: jest.fn(),
}))

const roomManager = require('../src/socket/roomManager')
const gameManager = require('../src/socket/gameManager')
const { createRobotScheduler } = require('../src/socket/robotScheduler')
const logger = require('../src/logger')
const { failing } = require('./helpers/lifecycleFailing')

const ROBOT_ID = '__robot__'

describe('handler', () => {
  let mockIo, mockSocket, eventHandlers, connectionHandler

  beforeEach(() => {
    jest.clearAllMocks()

    const mockRobotScheduler = {
      schedule: jest.fn(),
      clear: jest.fn(),
      clearAll: jest.fn(),
      accelerate: jest.fn(),
      getEndAt: jest.fn(),
      getRemainingMs: jest.fn(),
    }
    createRobotScheduler.mockReturnValue(mockRobotScheduler)

    roomManager.ROBOT_ID = ROBOT_ID
    roomManager.joinRoom.mockReturnValue({ id: 'default', players: [] })
    roomManager.leaveRoom.mockReturnValue({ id: 'default', players: [] })
    roomManager.handleDisconnect.mockReturnValue({ id: 'default', players: [] })
    roomManager.getRoom.mockReturnValue(null)
    roomManager.selectRole.mockReturnValue({})
    roomManager.deselectRole.mockReturnValue({})
    roomManager.setGameMode.mockReturnValue({})

    gameManager.getGame.mockReturnValue(null)
    gameManager.submitInput.mockReturnValue({ action: 'error', message: '游戏不存在' })
    gameManager.buildStartPayload.mockReturnValue({})
    gameManager.buildPlayerRoundResultPayload.mockReturnValue({})
    gameManager.buildMatchResultPayload.mockReturnValue({})
    gameManager.buildQuestionPayload.mockReturnValue({})
    gameManager.createNextQuestion.mockReturnValue(null)
    gameManager.getRobotScheduleAfterWaiting.mockReturnValue(null)
    gameManager.handleRobotInput.mockReturnValue(null)
    gameManager.createGame.mockReturnValue({ type: 'rps', players: [], status: 'playing' })

    eventHandlers = {}
    mockSocket = {
      id: 'socket-1',
      emit: jest.fn(),
      on: jest.fn((event, cb) => { eventHandlers[event] = cb }),
      join: jest.fn(),
      to: jest.fn().mockReturnThis(),
    }

    mockIo = {
      on: jest.fn((event, cb) => {
        if (event === 'connection') connectionHandler = cb
      }),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    }

    registerHandlers(mockIo)
    connectionHandler(mockSocket)
  })

  // ==================== 问题 1：离开/断线 → robotScheduler.clear ====================

  describe('room:leave — 最后一人离开时清理 robotScheduler', () => {
    it('leaveRoom 返回 null（房间删除）时调用 clear', () => {
      eventHandlers['room:join']({ nickname: '小明' })
      roomManager.leaveRoom.mockReturnValue(null)
      eventHandlers['room:leave']()
      expect(createRobotScheduler().clear).toHaveBeenCalledWith('default')
    })

    it('leaveRoom 返回 state（房间非空）时不调用 clear', () => {
      eventHandlers['room:join']({ nickname: '小明' })
      const mockState = { id: 'default', players: [{ id: 'socket-2' }] }
      roomManager.leaveRoom.mockReturnValue(mockState)
      eventHandlers['room:leave']()
      expect(createRobotScheduler().clear).not.toHaveBeenCalled()
    })
  })

  describe('disconnect — 最后一人断线时清理 robotScheduler', () => {
    it('handleDisconnect 返回 null（房间删除）时调用 clear', () => {
      eventHandlers['room:join']({ nickname: '小明' })
      roomManager.handleDisconnect.mockReturnValue(null)
      eventHandlers['disconnect']()
      expect(createRobotScheduler().clear).toHaveBeenCalledWith('default')
    })

    it('handleDisconnect 返回 state（房间非空）时不调用 clear', () => {
      eventHandlers['room:join']({ nickname: '小明' })
      const mockState = { id: 'default', players: [{ id: 'socket-2' }] }
      roomManager.handleDisconnect.mockReturnValue(mockState)
      eventHandlers['disconnect']()
      expect(createRobotScheduler().clear).not.toHaveBeenCalled()
    })
  })

  // ==================== 问题 2：game:rematch 类型拦截 ====================

  describe('game:rematch — 非 RPS 模式拒绝', () => {
    it('算术 match_end 后 rematch 被拒绝', () => {
      roomManager.getRoom.mockReturnValue({
        id: 'default',
        players: { 'socket-1': { nickname: '小明' } },
        game: { type: 'arithmetic', players: ['socket-1'], status: 'match_end' },
      })
      eventHandlers['game:rematch']({ roomId: 'default' })
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'game:error',
        { message: '当前游戏不支持该重赛方式' }
      )
    })

    it('RPS match_end 允许 rematch', () => {
      roomManager.getRoom.mockReturnValue({
        id: 'default',
        players: {
          'socket-1': { nickname: '小明' },
          'socket-2': { nickname: '小红' },
        },
        game: {
          type: 'rps', players: ['socket-1', 'socket-2'],
          status: 'match_end', scores: {}, roomId: 'default',
          id: 'g1',
        },
      })
      gameManager.createGame.mockReturnValue({
        type: 'rps', players: ['socket-1', 'socket-2'], status: 'playing',
      })
      eventHandlers['game:rematch']({ roomId: 'default' })
      expect(gameManager.createGame).toHaveBeenCalledWith('default', ['socket-1', 'socket-2'], 'rps')
    })

    it('game 不存在时 rematch 返回 error', () => {
      roomManager.getRoom.mockReturnValue({
        id: 'default',
        players: { 'socket-1': { nickname: '小明' } },
        game: null,
      })
      eventHandlers['game:rematch']({ roomId: 'default' })
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'game:error',
        { message: '没有可重赛的已结束比赛' }
      )
    })
  })

  // ==================== 问题 3：非字符串默写答案 ====================

  describe('game:answer — 非字符串默写答案被拒绝', () => {
    beforeEach(() => {
      eventHandlers['room:join']({ nickname: '小明' })
      gameManager.getGame.mockReturnValue({ type: 'spelling', status: 'playing' })
    })

    it('数字答案 123 → game:error', () => {
      gameManager.submitInput.mockReturnValue({
        action: 'error',
        message: '答案必须是非空字符串',
      })
      eventHandlers['game:answer']({ questionId: 'q1', answer: 123 })
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'game:error',
        { message: '答案必须是非空字符串' }
      )
    })

    it('对象答案 {} → game:error', () => {
      gameManager.submitInput.mockReturnValue({
        action: 'error',
        message: '答案必须是非空字符串',
      })
      eventHandlers['game:answer']({ questionId: 'q1', answer: {} })
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'game:error',
        { message: '答案必须是非空字符串' }
      )
    })
  })

  describe('RPS 日志使用出拳语义', () => {
    beforeEach(() => {
      eventHandlers['room:join']({ nickname: '小明' })
      roomManager.getRoom.mockReturnValue({
        id: 'default',
        players: {
          'socket-1': { nickname: '小明' },
          'socket-2': { nickname: '小红' },
        },
        game: {
          type: 'rps',
          players: ['socket-1', 'socket-2'],
          status: 'playing',
        },
      })
      gameManager.getGame.mockReturnValue({
        type: 'rps',
        players: ['socket-1', 'socket-2'],
        status: 'playing',
      })
    })

    it('等待对手出拳时不记录为答错', () => {
      gameManager.submitInput.mockReturnValue({
        action: 'waiting',
        reason: 'waiting_opponent',
      })

      eventHandlers['game:move']({ choice: 'rock' })

      expect(logger.info).toHaveBeenCalledWith('[move] 小明 → rock | 等待对手出拳')
      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('[answer]'))
      expect(mockSocket.emit).toHaveBeenCalledWith('game:waiting')
    })

    it('结算时使用“局/胜出”文案', () => {
      gameManager.submitInput.mockReturnValue({
        action: 'round_result',
        result: {
          round: 1,
          winner: 'socket-1',
          moves: { 'socket-1': 'rock', 'socket-2': 'scissors' },
          scores: { 'socket-1': 1, 'socket-2': 0 },
        },
      })

      eventHandlers['game:move']({ choice: 'scissors' })

      expect(logger.info).toHaveBeenCalledWith('[round] 第1局 — 小明 胜出')
      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('答对'))
    })

    it('平局时记录为平局', () => {
      gameManager.submitInput.mockReturnValue({
        action: 'round_result',
        result: {
          round: 1,
          winner: 'draw',
          moves: { 'socket-1': 'rock', 'socket-2': 'rock' },
          scores: { 'socket-1': 0, 'socket-2': 0 },
        },
      })

      eventHandlers['game:move']({ choice: 'rock' })

      expect(logger.info).toHaveBeenCalledWith('[round] 第1局 — 平局')
    })
  })

  // ==================== v3.6 Phase 2 步骤 2b：生命周期测试基线 ====================
  // 以下用例把 lifecycle-design.md 第 4-7 节的状态/权限矩阵逐条转成 Handler 单测。
  // 当前已满足的规则用 it() 正常断言；当前违反的规则用 failing() 标记为“预期失败”
  // （当前红 -> 绿；2d/2e/2f/2g 修复后 -> 红，逼出标记移除，2j 按 issueId 批量毕业）。
  // 断言只写可观察行为层（emit 事件/收件人/次数、room.game 清理、机器人调度清理、
  // 错误文案逐字），不写依赖 2c 统一入口的 gameId 内部调用形态。

  // ===== 2b 状态构造 helper（纯对象，不依赖 mock） =====
  const players = (...entries) =>
    Object.fromEntries(
      entries.map(([id, nickname, role = null]) => [id, { id, nickname, role }])
    )
  const makeGame = ({ type = 'rps', players: gplayers, status = 'playing', id = 'g1' }) => ({
    id,
    type,
    players: gplayers,
    status,
    scores: {},
    roomId: 'default',
  })
  const makeRoom = ({ pls, roles = {}, game = null, gameMode } = {}) => ({
    id: 'default',
    players: pls,
    roles,
    game,
    gameMode: gameMode || (game ? game.type : 'rps'),
    spellingDifficulty: 'easy',
  })
  // 加入房间建立 currentRoom，再清空 join 期间的 mock 调用记录，保留默认 mockReturnValue
  const joinAndReset = (nickname = '小明') => {
    eventHandlers['room:join']({ nickname })
    jest.clearAllMocks()
  }

  // ---------------- 等待中（design §5.1） ----------------

  describe('生命周期基线 - 等待中', () => {
    it('合法挑战创建新对局并通知参赛者', () => {
      joinAndReset('小明')
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']),
          roles: { 爸爸: 'socket-1', 妈妈: 'socket-2' },
          game: null,
          gameMode: 'rps',
        })
      )
      gameManager.createGame.mockReturnValue(makeGame({ players: ['socket-1', 'socket-2'] }))

      eventHandlers['game:challenge']({ mode: 'rps', targetId: 'socket-2' })

      expect(gameManager.createGame).toHaveBeenCalledWith('default', ['socket-1', 'socket-2'], 'rps')
      expect(mockIo.to).toHaveBeenCalledWith('socket-1')
      expect(mockIo.to).toHaveBeenCalledWith('socket-2')
      expect(mockIo.emit).toHaveBeenCalledWith('game:start', expect.anything())
      expect(roomManager.broadcastRoomState).toHaveBeenCalledWith('default', mockIo)
    })

    it('等待中提交出拳 -> 没有进行中的比赛', () => {
      joinAndReset('小明')
      roomManager.getRoom.mockReturnValue(makeRoom({ pls: players(['socket-1', '小明', '爸爸']) }))
      gameManager.getGame.mockReturnValue(null)

      eventHandlers['game:move']({ choice: 'rock' })

      expect(mockSocket.emit).toHaveBeenCalledWith('game:error', { message: '没有进行中的比赛' })
    })

    failing('等待中认输应返回没有进行中的比赛', 'LIFE-002', '当前无对局认输静默 return 不报错', () => {
      joinAndReset('小明')
      roomManager.getRoom.mockReturnValue(makeRoom({ pls: players(['socket-1', '小明', '爸爸']) }))
      gameManager.getGame.mockReturnValue(null)

      eventHandlers['game:forfeit']({ roomId: 'default' })

      expect(mockSocket.emit).toHaveBeenCalledWith('game:error', { message: '没有进行中的比赛' })
    })

    it('等待中重赛 -> 没有可重赛的已结束比赛', () => {
      joinAndReset('小明')
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸']), game: null })
      )

      eventHandlers['game:rematch']({ roomId: 'default' })

      expect(mockSocket.emit).toHaveBeenCalledWith('game:error', {
        message: '没有可重赛的已结束比赛',
      })
    })

    it('等待中主动离开通知剩余成员且不清对局调度', () => {
      joinAndReset('小明')
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']) })
      )
      gameManager.getGame.mockReturnValue(null)
      roomManager.leaveRoom.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['room:leave']()

      expect(roomManager.leaveRoom).toHaveBeenCalledWith(mockSocket, 'default')
      expect(mockSocket.emit).toHaveBeenCalledWith('player:left', { socketId: 'socket-1' })
      expect(roomManager.broadcastRoomState).toHaveBeenCalledWith('default', mockIo)
      expect(roomManager.clearGame).not.toHaveBeenCalled()
    })

    it('重复离开不重复广播 player:left', () => {
      joinAndReset('小明')
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']) })
      )
      roomManager.leaveRoom.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['room:leave']()
      jest.clearAllMocks()
      eventHandlers['room:leave']()

      expect(roomManager.leaveRoom).not.toHaveBeenCalled()
      expect(mockSocket.emit).not.toHaveBeenCalled()
    })
  })

  // ---------------- 进行中（design §5.2） ----------------

  describe('生命周期基线 - 进行中', () => {
    it('进行中再挑战被独占拒绝', () => {
      joinAndReset('小明')
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']),
          game: makeGame({ players: ['socket-1', 'socket-2'], status: 'playing' }),
        })
      )

      eventHandlers['game:challenge']({ mode: 'rps', targetId: 'socket-2' })

      expect(mockSocket.emit).toHaveBeenCalledWith('game:error', {
        message: '当前房间已有进行中的比赛',
      })
      expect(gameManager.createGame).not.toHaveBeenCalled()
    })

    it('旁观者提交出拳被拒绝且不改对局', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-2', 'socket-3'], status: 'playing' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(
            ['socket-1', '小明', '爸爸'],
            ['socket-2', '小红', '妈妈'],
            ['socket-3', '小刚', '儿子']
          ),
          game,
        })
      )
      gameManager.getGame.mockReturnValue(game)
      gameManager.submitInput.mockReturnValue({ action: 'error', message: '你不是本局玩家' })

      eventHandlers['game:move']({ choice: 'rock' })

      expect(mockSocket.emit).toHaveBeenCalledWith('game:error', { message: '你不是本局玩家' })
      expect(roomManager.clearGame).not.toHaveBeenCalled()
    })

    it('参赛者认输清理对局并通知对手（RPS 1v1）', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-1', 'socket-2'], status: 'playing' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']), game })
      )
      gameManager.getGame.mockReturnValue(game)

      eventHandlers['game:forfeit']({ roomId: 'default' })

      expect(roomManager.clearGame).toHaveBeenCalledWith('default')
      expect(createRobotScheduler().clear).toHaveBeenCalledWith('default')
      expect(mockIo.to).toHaveBeenCalledWith('socket-2')
      expect(mockIo.to).not.toHaveBeenCalledWith('socket-1')
      expect(mockIo.emit).toHaveBeenCalledWith('game:forfeited', { message: '对手认输了' })
    })

    failing('非参赛者认输应只回你不是本局玩家且原对局不变', 'LIFE-002', '当前 game:forfeit 未校验发起者，旁观者可清理他人对局', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-2', 'socket-3'], status: 'playing' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(
            ['socket-1', '小明', '爸爸'],
            ['socket-2', '小红', '妈妈'],
            ['socket-3', '小刚', '儿子']
          ),
          game,
        })
      )
      gameManager.getGame.mockReturnValue(game)

      eventHandlers['game:forfeit']({ roomId: 'default' })

      expect(mockSocket.emit).toHaveBeenCalledWith('game:error', { message: '你不是本局玩家' })
      expect(roomManager.clearGame).not.toHaveBeenCalled()
    })

    failing('多参赛者认输应通知所有其他在线真人参赛者', 'LIFE-002', '当前只通知 game.players.find 的第一个其他玩家', () => {
      joinAndReset('小明')
      const game = makeGame({
        type: 'arithmetic',
        players: ['socket-1', 'socket-2', 'socket-3', ROBOT_ID],
        status: 'playing',
      })
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(
            ['socket-1', '小明', '爸爸'],
            ['socket-2', '小红', '妈妈'],
            ['socket-3', '小刚', '儿子'],
            [ROBOT_ID, '机器人', '机器人']
          ),
          game,
        })
      )
      gameManager.getGame.mockReturnValue(game)

      eventHandlers['game:forfeit']({ roomId: 'default' })

      expect(mockIo.to).toHaveBeenCalledWith('socket-2')
      expect(mockIo.to).toHaveBeenCalledWith('socket-3')
    })

    it('参赛者主动离开取消对局并通知对手（RPS）', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-1', 'socket-2'], status: 'playing' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']), game })
      )
      gameManager.getGame.mockReturnValue(game)
      roomManager.leaveRoom.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['room:leave']()

      expect(roomManager.clearGame).toHaveBeenCalledWith('default')
      expect(createRobotScheduler().clear).toHaveBeenCalledWith('default')
      expect(mockIo.to).toHaveBeenCalledWith('socket-2')
      expect(mockIo.emit).toHaveBeenCalledWith('game:cancelled', { message: '对手离开了房间' })
      expect(mockSocket.emit).toHaveBeenCalledWith('player:left', { socketId: 'socket-1' })
    })

    failing('算术参赛者主动离开应取消整场并通知其余在线真人', 'LIFE-001', '当前 cancelGameIfActive 对 arithmetic 直接 return，不取消不通知', () => {
      joinAndReset('小明')
      const game = makeGame({
        type: 'arithmetic',
        players: ['socket-1', 'socket-2', ROBOT_ID],
        status: 'playing',
      })
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(
            ['socket-1', '小明', '爸爸'],
            ['socket-2', '小红', '妈妈'],
            [ROBOT_ID, '机器人', '机器人']
          ),
          game,
        })
      )
      gameManager.getGame.mockReturnValue(game)
      roomManager.leaveRoom.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['room:leave']()

      expect(roomManager.clearGame).toHaveBeenCalledWith('default')
      expect(mockIo.emit).toHaveBeenCalledWith('game:cancelled', expect.anything())
    })

    failing('默写参赛者主动离开应取消整场并通知其余在线真人', 'LIFE-001', '当前 cancelGameIfActive 对 spelling 直接 return，不取消不通知', () => {
      joinAndReset('小明')
      const game = makeGame({
        type: 'spelling',
        players: ['socket-1', 'socket-2', ROBOT_ID],
        status: 'playing',
      })
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(
            ['socket-1', '小明', '爸爸'],
            ['socket-2', '小红', '妈妈'],
            [ROBOT_ID, '机器人', '机器人']
          ),
          game,
        })
      )
      gameManager.getGame.mockReturnValue(game)
      roomManager.leaveRoom.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['room:leave']()

      expect(roomManager.clearGame).toHaveBeenCalledWith('default')
      expect(mockIo.emit).toHaveBeenCalledWith('game:cancelled', expect.anything())
    })

    it('旁观者主动离开不影响进行中对局', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-2', 'socket-3'], status: 'playing' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(
            ['socket-1', '小明', '爸爸'],
            ['socket-2', '小红', '妈妈'],
            ['socket-3', '小刚', '儿子']
          ),
          game,
        })
      )
      gameManager.getGame.mockReturnValue(game)
      roomManager.leaveRoom.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['room:leave']()

      expect(roomManager.clearGame).not.toHaveBeenCalled()
      expect(createRobotScheduler().clear).not.toHaveBeenCalled()
      expect(mockIo.emit).not.toHaveBeenCalledWith('game:cancelled', expect.anything())
      expect(mockSocket.emit).toHaveBeenCalledWith('player:left', { socketId: 'socket-1' })
    })

    it('参赛者断线取消对局并通知对手（RPS）', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-1', 'socket-2'], status: 'playing' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']), game })
      )
      gameManager.getGame.mockReturnValue(game)
      roomManager.handleDisconnect.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['disconnect']()

      expect(roomManager.clearGame).toHaveBeenCalledWith('default')
      expect(mockIo.emit).toHaveBeenCalledWith('game:cancelled', { message: '对手离开了房间' })
      expect(mockSocket.emit).toHaveBeenCalledWith('player:left', { socketId: 'socket-1' })
    })

    failing('算术参赛者断线应取消整场并通知其余在线真人', 'LIFE-001', '当前断线对 arithmetic 不取消', () => {
      joinAndReset('小明')
      const game = makeGame({ type: 'arithmetic', players: ['socket-1', 'socket-2'], status: 'playing' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']), game })
      )
      gameManager.getGame.mockReturnValue(game)
      roomManager.handleDisconnect.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['disconnect']()

      expect(roomManager.clearGame).toHaveBeenCalledWith('default')
      expect(mockIo.emit).toHaveBeenCalledWith('game:cancelled', expect.anything())
    })

    it('旁观者断线不影响进行中对局', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-2', 'socket-3'], status: 'playing' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(
            ['socket-1', '小明', '爸爸'],
            ['socket-2', '小红', '妈妈'],
            ['socket-3', '小刚', '儿子']
          ),
          game,
        })
      )
      gameManager.getGame.mockReturnValue(game)
      roomManager.handleDisconnect.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['disconnect']()

      expect(roomManager.clearGame).not.toHaveBeenCalled()
      expect(mockSocket.emit).toHaveBeenCalledWith('player:left', { socketId: 'socket-1' })
    })
  })

  // ---------------- 终局（design §5.3） ----------------

  describe('生命周期基线 - 终局', () => {
    it('旁观者离开终局保留旧对局', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-2', 'socket-3'], status: 'match_end' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(
            ['socket-1', '小明', '爸爸'],
            ['socket-2', '小红', '妈妈'],
            ['socket-3', '小刚', '儿子']
          ),
          game,
        })
      )
      gameManager.getGame.mockReturnValue(game)
      roomManager.leaveRoom.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['room:leave']()

      expect(roomManager.clearGame).not.toHaveBeenCalled()
      expect(mockSocket.emit).toHaveBeenCalledWith('player:left', { socketId: 'socket-1' })
    })

    it('终局挑战替换清理旧终局并创建新对局', () => {
      joinAndReset('小明')
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']),
          roles: { 爸爸: 'socket-1', 妈妈: 'socket-2' },
          game: makeGame({ players: ['socket-1', 'socket-2'], status: 'match_end', id: 'g-old' }),
          gameMode: 'rps',
        })
      )
      gameManager.createGame.mockReturnValue(makeGame({ players: ['socket-1', 'socket-2'], id: 'g-new' }))

      eventHandlers['game:challenge']({ mode: 'rps', targetId: 'socket-2' })

      expect(roomManager.clearGame).toHaveBeenCalledWith('default')
      expect(gameManager.createGame).toHaveBeenCalledWith('default', ['socket-1', 'socket-2'], 'rps')
    })

    failing('终局原参赛者离开应清除旧终局且不发取消通知', 'LIFE-FINAL', '当前 cancelGameIfActive 只处理 playing，match_end 不清理终局', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-1', 'socket-2'], status: 'match_end' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']), game })
      )
      gameManager.getGame.mockReturnValue(game)
      roomManager.leaveRoom.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['room:leave']()

      expect(roomManager.clearGame).toHaveBeenCalledWith('default')
      expect(mockIo.emit).not.toHaveBeenCalledWith('game:cancelled', expect.anything())
      expect(mockIo.emit).not.toHaveBeenCalledWith('game:forfeited', expect.anything())
    })

    failing('旁观者重赛应被拒绝且原终局不变', 'LIFE-REMATCH', '当前 game:rematch 只查 room.players 不查 game.players', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-2', 'socket-3'], status: 'match_end' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({
          pls: players(
            ['socket-1', '小明', '爸爸'],
            ['socket-2', '小红', '妈妈'],
            ['socket-3', '小刚', '儿子']
          ),
          game,
        })
      )
      gameManager.getGame.mockReturnValue(game)

      eventHandlers['game:rematch']({ roomId: 'default' })

      expect(mockSocket.emit).toHaveBeenCalledWith('game:error', { message: '你不是上一局玩家' })
      expect(roomManager.clearGame).not.toHaveBeenCalled()
      expect(gameManager.createGame).not.toHaveBeenCalled()
    })

    failing('原参赛者已离开时重赛应被拒绝', 'LIFE-REMATCH', '当前不校验所有原真人参赛者仍在线', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-1', 'socket-2'], status: 'match_end' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸']), game })
      )
      gameManager.getGame.mockReturnValue(game)

      eventHandlers['game:rematch']({ roomId: 'default' })

      expect(mockSocket.emit).toHaveBeenCalledWith('game:error', {
        message: '原参赛者已离开，无法重赛',
      })
      expect(gameManager.createGame).not.toHaveBeenCalled()
    })

    failing('非终局状态重赛应返回状态错误', 'LIFE-REMATCH', '当前 status!==match_end 静默 return 不报错', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-1', 'socket-2'], status: 'playing' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']), game })
      )
      gameManager.getGame.mockReturnValue(game)

      eventHandlers['game:rematch']({ roomId: 'default' })

      expect(mockSocket.emit).toHaveBeenCalledWith('game:error', {
        message: '没有可重赛的已结束比赛',
      })
      expect(gameManager.createGame).not.toHaveBeenCalled()
    })
  })

  // ---------------- 幂等与竞态（design §7，不依赖 gameId 的条目） ----------------

  describe('生命周期基线 - 幂等与竞态', () => {
    it('重复认输不重复发送 game:forfeited', () => {
      joinAndReset('小明')
      const game = makeGame({ players: ['socket-1', 'socket-2'], status: 'playing' })
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']), game })
      )
      gameManager.getGame.mockReturnValue(game)

      eventHandlers['game:forfeit']({ roomId: 'default' })
      // 第一次认输已清理对局：后续 getGame 返回 null 模拟对局已清
      gameManager.getGame.mockReturnValue(null)
      jest.clearAllMocks()
      eventHandlers['game:forfeit']({ roomId: 'default' })

      expect(roomManager.clearGame).not.toHaveBeenCalled()
      expect(mockIo.emit).not.toHaveBeenCalledWith('game:forfeited', expect.anything())
    })

    it('离开后旧 Socket 提交输入被拒绝', () => {
      joinAndReset('小明')
      roomManager.getRoom.mockReturnValue(
        makeRoom({ pls: players(['socket-1', '小明', '爸爸'], ['socket-2', '小红', '妈妈']) })
      )
      gameManager.getGame.mockReturnValue(null)
      roomManager.leaveRoom.mockReturnValue({ id: 'default', players: [{ id: 'socket-2' }] })

      eventHandlers['room:leave']()
      // 离开后 currentRoom=null，旧 Socket 再提交输入
      eventHandlers['game:move']({ choice: 'rock' })

      expect(mockSocket.emit).toHaveBeenCalledWith('game:error', { message: '请先加入房间' })
    })
  })

})
