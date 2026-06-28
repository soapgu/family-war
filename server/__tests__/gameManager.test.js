jest.mock('../src/socket/roomManager', () => ({
  setGame: jest.fn(),
  clearGame: jest.fn(),
  getRoom: jest.fn(),
}))

const roomManager = require('../src/socket/roomManager')
const gameManager = require('../src/socket/gameManager')

const ROOM_ID = 'default'
const P1 = 's1'
const P2 = 's2'

/**
 * 创建一个可用的 mock room（包含 game）
 */
function mockRoom(game) {
  return { id: ROOM_ID, players: {}, roles: {}, game: game || null }
}

beforeEach(() => {
  jest.clearAllMocks()
  gameManager.matchHistory = []
})

// ==================== createGame ====================

describe('createGame', () => {
  it('创建游戏并调用 roomManager.setGame', () => {
    const game = gameManager.createGame(ROOM_ID, P1, P2)

    expect(game.id).toContain(ROOM_ID)
    expect(game.players).toEqual([P1, P2])
    expect(game.round).toBe(1)
    expect(game.scores).toEqual({ [P1]: 0, [P2]: 0 })
    expect(game.moves).toEqual({})
    expect(game.history).toEqual([])
    expect(game.status).toBe('playing')

    expect(roomManager.setGame).toHaveBeenCalledWith(ROOM_ID, game)
  })
})

// ==================== submitMove ====================

describe('submitMove', () => {
  /** 创建一个新 game 并注入到 mock room 中 */
  function startGame() {
    const game = gameManager.createGame(ROOM_ID, P1, P2)
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    return game
  }

  it('首次出拳返回 waiting', () => {
    startGame()
    const result = gameManager.submitMove(ROOM_ID, P1, 'rock')
    expect(result.action).toBe('waiting')
  })

  it('双方出拳后返回本局结果（赢）', () => {
    startGame()
    gameManager.submitMove(ROOM_ID, P1, 'rock')
    const result = gameManager.submitMove(ROOM_ID, P2, 'scissors')

    expect(result.action).toBe('round_result')
    expect(result.winner).toBe(P1)
    expect(result.scores[P1]).toBe(1)
    expect(result.scores[P2]).toBe(0)
  })

  it('平局后 scores 不变，继续下一局', () => {
    startGame()
    gameManager.submitMove(ROOM_ID, P1, 'rock')
    const result = gameManager.submitMove(ROOM_ID, P2, 'rock')

    expect(result.action).toBe('round_result')
    expect(result.winner).toBeNull()
    expect(result.scores[P1]).toBe(0)
    expect(result.scores[P2]).toBe(0)
    expect(result.round).toBe(1)
  })

  it('先赢 2 局者获胜（2-0）', () => {
    startGame()
    // 第 1 局 P1 赢
    gameManager.submitMove(ROOM_ID, P1, 'rock')
    gameManager.submitMove(ROOM_ID, P2, 'scissors')
    // 第 2 局 P1 再赢 → match_end
    gameManager.submitMove(ROOM_ID, P1, 'paper')
    const result = gameManager.submitMove(ROOM_ID, P2, 'rock')

    expect(result.action).toBe('match_result')
    expect(result.matchWinner).toBe(P1)
    expect(result.scores[P1]).toBe(2)

    expect(roomManager.clearGame).toHaveBeenCalledWith(ROOM_ID)
  })

  it('2-1 反转获胜', () => {
    startGame()
    // P1 赢第 1 局
    gameManager.submitMove(ROOM_ID, P1, 'rock')
    gameManager.submitMove(ROOM_ID, P2, 'scissors')
    // P2 赢第 2 局
    gameManager.submitMove(ROOM_ID, P1, 'rock')
    gameManager.submitMove(ROOM_ID, P2, 'paper')
    // P2 赢第 3 局 → 2-1 获胜
    gameManager.submitMove(ROOM_ID, P1, 'scissors')
    const result = gameManager.submitMove(ROOM_ID, P2, 'rock')

    expect(result.action).toBe('match_result')
    expect(result.matchWinner).toBe(P2)
    expect(result.scores[P2]).toBe(2)
  })

  it('无效 choice 返回 error', () => {
    startGame()
    const result = gameManager.submitMove(ROOM_ID, P1, 'gun')
    expect(result.action).toBe('error')
    expect(result.message).toBe('无效的出拳')
  })

  it('非本局玩家出拳返回 error', () => {
    startGame()
    const result = gameManager.submitMove(ROOM_ID, 's3', 'rock')
    expect(result.action).toBe('error')
    expect(result.message).toBe('你不是本局玩家')
  })

  it('不存在的游戏返回 error', () => {
    roomManager.getRoom.mockReturnValue(null)
    const result = gameManager.submitMove(ROOM_ID, P1, 'rock')
    expect(result.action).toBe('error')
    expect(result.message).toBe('游戏不存在')
  })

  it('同一玩家重复出拳返回 error', () => {
    startGame()
    gameManager.submitMove(ROOM_ID, P1, 'rock')
    const result = gameManager.submitMove(ROOM_ID, P1, 'paper')
    expect(result.action).toBe('error')
    expect(result.message).toBe('你已经出过拳了')
  })

  it('比赛结束后不能再出拳', () => {
    startGame()
    // P1 连赢两局
    gameManager.submitMove(ROOM_ID, P1, 'rock')
    gameManager.submitMove(ROOM_ID, P2, 'scissors')
    gameManager.submitMove(ROOM_ID, P1, 'paper')
    gameManager.submitMove(ROOM_ID, P2, 'rock')

    const result = gameManager.submitMove(ROOM_ID, P1, 'scissors')
    expect(result.action).toBe('error')
    expect(result.message).toBe('比赛已结束')
  })

  it('历史记录正确累积', () => {
    startGame()
    gameManager.submitMove(ROOM_ID, P1, 'rock')
    gameManager.submitMove(ROOM_ID, P2, 'scissors')

    const room = roomManager.getRoom(ROOM_ID)
    expect(room.game.history).toHaveLength(1)
    expect(room.game.history[0].winner).toBe(P1)
    expect(room.game.history[0].round).toBe(1)
  })


})

// ==================== handleDisconnect ====================

describe('handleDisconnect', () => {
  function startGame() {
    const game = gameManager.createGame(ROOM_ID, P1, P2)
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    return game
  }

  it('比赛中断线返回 cancelled', () => {
    startGame()
    const result = gameManager.handleDisconnect(ROOM_ID, P1)

    expect(result).toEqual({ action: 'cancelled' })
    expect(roomManager.clearGame).toHaveBeenCalledWith(ROOM_ID)
  })

  it('非比赛玩家断线返回 null', () => {
    startGame()
    const result = gameManager.handleDisconnect(ROOM_ID, 's3')
    expect(result).toBeNull()
  })

  it('不存在的房间返回 null', () => {
    roomManager.getRoom.mockReturnValue(null)
    const result = gameManager.handleDisconnect(ROOM_ID, P1)
    expect(result).toBeNull()
  })

  it('已结束的比赛断线返回 null', () => {
    startGame()
    // 直接模拟比赛已结束
    const room = roomManager.getRoom(ROOM_ID)
    room.game.status = 'match_end'

    const result = gameManager.handleDisconnect(ROOM_ID, P1)
    expect(result).toBeNull()
  })
})

// ==================== getGame ====================

describe('getGame', () => {
  it('存在游戏时返回 game 对象', () => {
    const game = gameManager.createGame(ROOM_ID, P1, P2)
    roomManager.getRoom.mockReturnValue(mockRoom(game))

    const result = gameManager.getGame(ROOM_ID)
    expect(result).toBe(game)
  })

  it('不存在游戏时返回 null', () => {
    roomManager.getRoom.mockReturnValue(null)
    expect(gameManager.getGame(ROOM_ID)).toBeNull()
  })

  it('房间 game 为 null 时返回 null', () => {
    roomManager.getRoom.mockReturnValue(mockRoom(null))
    expect(gameManager.getGame(ROOM_ID)).toBeNull()
  })
})

// ==================== getMatchHistory ====================

describe('getMatchHistory', () => {
  it('比赛结束后记录历史', () => {
    const game = gameManager.createGame(ROOM_ID, P1, P2)
    roomManager.getRoom.mockReturnValue(mockRoom(game))

    gameManager.submitMove(ROOM_ID, P1, 'rock')
    gameManager.submitMove(ROOM_ID, P2, 'scissors')
    gameManager.submitMove(ROOM_ID, P1, 'paper')
    gameManager.submitMove(ROOM_ID, P2, 'rock')

    const history = gameManager.getMatchHistory()
    expect(history).toHaveLength(1)
    expect(history[0].matchWinner).toBe(P1)
    expect(history[0].roomId).toBe(ROOM_ID)
    expect(history[0].players).toEqual([P1, P2])
    expect(history[0].scores).toEqual({ [P1]: 2, [P2]: 0 })
    expect(typeof history[0].endedAt).toBe('number')
  })

  it('多场比赛累积记录', () => {
    // 第 1 场
    const g1 = gameManager.createGame(ROOM_ID, P1, P2)
    roomManager.getRoom.mockReturnValue(mockRoom(g1))
    gameManager.submitMove(ROOM_ID, P1, 'rock')
    gameManager.submitMove(ROOM_ID, P2, 'scissors')
    gameManager.submitMove(ROOM_ID, P1, 'paper')
    gameManager.submitMove(ROOM_ID, P2, 'rock')

    // 第 2 场
    const g2 = gameManager.createGame(ROOM_ID, P1, P2)
    roomManager.getRoom.mockReturnValue(mockRoom(g2))
    gameManager.submitMove(ROOM_ID, P1, 'rock')
    gameManager.submitMove(ROOM_ID, P2, 'scissors')
    gameManager.submitMove(ROOM_ID, P1, 'paper')
    gameManager.submitMove(ROOM_ID, P2, 'rock')

    expect(gameManager.getMatchHistory()).toHaveLength(2)
  })

  it('没有比赛时返回空数组', () => {
    expect(gameManager.getMatchHistory()).toEqual([])
  })
})
