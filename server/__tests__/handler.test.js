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

const roomManager = require('../src/socket/roomManager')
const gameManager = require('../src/socket/gameManager')
const { createRobotScheduler } = require('../src/socket/robotScheduler')

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
})
