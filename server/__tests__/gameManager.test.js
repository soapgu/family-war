jest.mock('../src/socket/roomManager', () => ({
  setGame: jest.fn(),
  clearGame: jest.fn(),
  getRoom: jest.fn(),
  ROBOT_ID: '__robot__',
}))

jest.mock('../src/unsplashClient', () => ({
  getImageUrl: jest.fn(() => ''),
  getSyncStatus: jest.fn(() => ({ total: 0, synced: 0, pending: 0, words: [] })),
  getSyncRunning: jest.fn(() => false),
}))

jest.mock('../src/data/wordBank', () => ({
  getAllWords: jest.fn(() => ['classroom', 'art room', 'library']),
  getActiveWords: jest.fn(() => ['classroom', 'art room', 'library']),
}))

const roomManager = require('../src/socket/roomManager')
const gameManager = require('../src/socket/gameManager')
const unsplashClient = require('../src/unsplashClient')
const wordBank = require('../src/data/wordBank')

const ROOM_ID = 'default'
const P1 = 's1'
const P2 = 's2'
const P3 = 's3'
const ROBOT = '__robot__'

function mockRoom(game) {
  return {
    id: ROOM_ID,
    players: {},
    roles: {},
    game: game || null,
  }
}

function mockRoomWithPlayers(game, playerIds) {
  const players = {}
  playerIds.forEach((id) => {
    players[id] = {
      id,
      nickname: id === ROBOT ? '机器人' : `玩家${id}`,
      role: null,
      online: true,
    }
  })
  return { id: ROOM_ID, players, roles: {}, game: game || null }
}

beforeEach(() => {
  jest.clearAllMocks()
  wordBank.getActiveWords.mockReturnValue(['classroom', 'art room', 'library'])
  gameManager.matchHistory = []
})

// ==================== createGame ====================

describe('createGame', () => {
  it('创建游戏并调用 roomManager.setGame', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')

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

// ==================== getGame ====================

describe('getGame', () => {
  it('存在游戏时返回 game 对象', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
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
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
    roomManager.getRoom.mockReturnValue(mockRoom(game))

    gameManager.submitInput(ROOM_ID, P1, { choice: 'rock' })
    gameManager.submitInput(ROOM_ID, P2, { choice: 'scissors' })
    gameManager.submitInput(ROOM_ID, P1, { choice: 'paper' })
    gameManager.submitInput(ROOM_ID, P2, { choice: 'rock' })

    const history = gameManager.getMatchHistory()
    expect(history).toHaveLength(1)
    expect(history[0].matchWinner).toBe(P1)
    expect(history[0].roomId).toBe(ROOM_ID)
    expect(history[0].players).toEqual([P1, P2])
    expect(history[0].scores).toEqual({ [P1]: 2, [P2]: 0 })
    expect(typeof history[0].endedAt).toBe('number')
  })

  it('多场比赛累积记录', () => {
    const g1 = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
    roomManager.getRoom.mockReturnValue(mockRoom(g1))
    gameManager.submitInput(ROOM_ID, P1, { choice: 'rock' })
    gameManager.submitInput(ROOM_ID, P2, { choice: 'scissors' })
    gameManager.submitInput(ROOM_ID, P1, { choice: 'paper' })
    gameManager.submitInput(ROOM_ID, P2, { choice: 'rock' })

    const g2 = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
    roomManager.getRoom.mockReturnValue(mockRoom(g2))
    gameManager.submitInput(ROOM_ID, P1, { choice: 'rock' })
    gameManager.submitInput(ROOM_ID, P2, { choice: 'scissors' })
    gameManager.submitInput(ROOM_ID, P1, { choice: 'paper' })
    gameManager.submitInput(ROOM_ID, P2, { choice: 'rock' })

    expect(gameManager.getMatchHistory()).toHaveLength(2)
  })

  it('没有比赛时返回空数组', () => {
    expect(gameManager.getMatchHistory()).toEqual([])
  })
})

// ==================== 算术引擎 ====================

describe('算术 createGame', () => {
  it('创建算术游戏并调用 roomManager.setGame', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2, P3], 'arithmetic')

    expect(game.type).toBe('arithmetic')
    expect(game.players).toEqual([P1, P2, P3])
    expect(game.round).toBe(1)
    expect(game.scores).toEqual({ [P1]: 0, [P2]: 0, [P3]: 0 })
    expect(game.currentQuestion).toBeNull()
    expect(game.answeredThisRound).toEqual({})
    expect(game.history).toEqual([])
    expect(game.status).toBe('playing')

    expect(roomManager.setGame).toHaveBeenCalledWith(ROOM_ID, game)
  })
})

// ==================== 默写引擎 ====================

describe('默写 createGame', () => {
  it('创建默写游戏并调用 roomManager.setGame', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'spelling', 'easy')

    expect(game.type).toBe('spelling')
    expect(game.difficulty).toBe('easy')
    expect(game.players).toEqual([P1, P2])
    expect(game.round).toBe(1)
    expect(game.scores).toEqual({ [P1]: 0, [P2]: 0 })
    expect(game.currentQuestion).toBeNull()
    expect(game.answeredThisRound).toEqual({})
    expect(game.history).toEqual([])
    expect(game.status).toBe('playing')

    expect(roomManager.setGame).toHaveBeenCalledWith(ROOM_ID, game)
  })

  it('默认 difficulty 为 easy', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'spelling')
    expect(game.difficulty).toBe('easy')
  })
})

// ==================== areAllHumansAnswered ====================

describe('areAllHumansAnswered', () => {
  function startSpellingGame() {
    const game = gameManager.createGame(ROOM_ID, [P1, P2, ROBOT], 'spelling', 'easy')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2, ROBOT]))
    return game
  }

  it('无人作答时返回 false', () => {
    startSpellingGame()
    expect(gameManager.areAllHumansAnswered(ROOM_ID)).toBe(false)
  })

  it('部分人类作答返回 false', () => {
    startSpellingGame()
    const question = gameManager.createNextQuestion(ROOM_ID)
    gameManager.submitInput(ROOM_ID, P1, { questionId: question.questionId, answer: 'wrong' })
    expect(gameManager.areAllHumansAnswered(ROOM_ID)).toBe(false)
  })

  it('所有人类答错返回 true', () => {
    startSpellingGame()
    const question = gameManager.createNextQuestion(ROOM_ID)
    gameManager.submitInput(ROOM_ID, P1, { questionId: question.questionId, answer: 'wrong' })
    gameManager.submitInput(ROOM_ID, P2, { questionId: question.questionId, answer: 'wrong' })
    expect(gameManager.areAllHumansAnswered(ROOM_ID)).toBe(true)
  })

  it('只有机器人时返回 false', () => {
    const game = gameManager.createGame(ROOM_ID, [ROBOT], 'spelling', 'easy')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [ROBOT]))
    expect(gameManager.areAllHumansAnswered(ROOM_ID)).toBe(false)
  })
})

// ==================== shouldScheduleRobot ====================

describe('shouldScheduleRobot', () => {
  it('RPS 游戏返回 false', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    expect(gameManager.shouldScheduleRobot(ROOM_ID)).toBe(false)
  })

  it('算术游戏 currentQuestion 存在时返回 true', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2, ROBOT], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2, ROBOT]))
    gameManager.createNextQuestion(ROOM_ID)
    expect(gameManager.shouldScheduleRobot(ROOM_ID)).toBe(true)
  })

  it('算术游戏无 currentQuestion 返回 false', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2, ROBOT], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2, ROBOT]))
    expect(gameManager.shouldScheduleRobot(ROOM_ID)).toBe(false)
  })

  it('不存在的房间返回 false', () => {
    roomManager.getRoom.mockReturnValue(null)
    expect(gameManager.shouldScheduleRobot('no_such_room')).toBe(false)
  })
})

// ==================== getRobotDelayMs ====================

describe('getRobotDelayMs', () => {
  it('算术返回 20000', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    expect(gameManager.getRobotDelayMs(ROOM_ID)).toBe(20000)
  })

  it('默写 easy 返回 40000', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'spelling', 'easy')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    expect(gameManager.getRobotDelayMs(ROOM_ID)).toBe(40000)
  })

  it('不存在的房间返回 0', () => {
    roomManager.getRoom.mockReturnValue(null)
    expect(gameManager.getRobotDelayMs('no_such_room')).toBe(0)
  })
})

// ==================== handleRobotInput（统一） ====================

describe('handleRobotInput（统一）', () => {
  it('算术返回嵌套格式', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, ROBOT], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, ROBOT]))
    const q = gameManager.createNextQuestion(ROOM_ID)
    const result = gameManager.handleRobotInput(ROOM_ID, q.questionId)
    expect(result.action).toBe('round_result')
    expect(result.result).toBeTruthy()
    expect(result.result.winner).toBe(ROBOT)
  })

  it('过期题目返回 null', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, ROBOT], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, ROBOT]))
    const q = gameManager.createNextQuestion(ROOM_ID)
    game.currentQuestion = null
    const result = gameManager.handleRobotInput(ROOM_ID, q.questionId)
    expect(result).toBeNull()
  })
})

// ==================== getRobotScheduleAfterWaiting ====================

describe('getRobotScheduleAfterWaiting', () => {
  it('全部人类答完返回加速意图', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, ROBOT], 'spelling', 'easy')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, ROBOT]))
    const q = gameManager.createNextQuestion(ROOM_ID)
    gameManager.submitInput(ROOM_ID, P1, { questionId: q.questionId, answer: 'wrong' })
    const intent = gameManager.getRobotScheduleAfterWaiting(ROOM_ID)
    expect(intent).toEqual({ action: 'accelerate', delayMs: 5000, onlyIfRemainingGreaterThanMs: 5000 })
  })

  it('有人类未答返回 null', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2, ROBOT], 'spelling', 'easy')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2, ROBOT]))
    const q = gameManager.createNextQuestion(ROOM_ID)
    gameManager.submitInput(ROOM_ID, P1, { questionId: q.questionId, answer: 'wrong' })
    const intent = gameManager.getRobotScheduleAfterWaiting(ROOM_ID)
    expect(intent).toBeNull()
  })

  it('算术游戏返回 null', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, ROBOT], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, ROBOT]))
    gameManager.createNextQuestion(ROOM_ID)
    const intent = gameManager.getRobotScheduleAfterWaiting(ROOM_ID)
    expect(intent).toBeNull()
  })
})

// ==================== submitInput（统一） ====================

describe('submitInput（统一）', () => {
  it('RPS 出拳返回嵌套格式', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    const result = gameManager.submitInput(ROOM_ID, P1, { choice: 'rock' })
    expect(result.action).toBe('waiting')
    expect(result.reason).toBe('waiting_opponent')
  })

  it('算术答题返回嵌套格式', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    const q = gameManager.createNextQuestion(ROOM_ID)
    const result = gameManager.submitInput(ROOM_ID, P1, { questionId: q.questionId, answer: q.correctAnswer })
    expect(result.action).toBe('round_result')
    expect(result.result.winner).toBe(P1)
  })

  it('默写答题返回嵌套格式', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'spelling', 'easy')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2]))
    const q = gameManager.createNextQuestion(ROOM_ID)
    const result = gameManager.submitInput(ROOM_ID, P1, { questionId: q.questionId, answer: q.word })
    expect(result.action).toBe('round_result')
    expect(result.result.winner).toBe(P1)
  })

  it('不存在的游戏返回 error', () => {
    roomManager.getRoom.mockReturnValue(null)
    const result = gameManager.submitInput('no_such_room', P1, { choice: 'rock' })
    expect(result.action).toBe('error')
  })
})

// ==================== buildStartPayload ====================

describe('buildStartPayload', () => {
  it('RPS 每人视角含 opponent', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
    const room = { id: ROOM_ID, players: { [P1]: { nickname: '小明', role: '爸爸' }, [P2]: { nickname: '小红', role: '妈妈' } }, game }
    roomManager.getRoom.mockReturnValue(room)
    const p = gameManager.buildStartPayload(ROOM_ID, P1)
    expect(p.gameType).toBe('rps')
    expect(p.opponent.nickname).toBe('小红')
  })

  it('算术含 players/firstQuestion', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2]))
    const q = gameManager.createNextQuestion(ROOM_ID)
    const p = gameManager.buildStartPayload(ROOM_ID, P1, q)
    expect(p.gameType).toBe('arithmetic')
    expect(p.players).toHaveLength(2)
    expect(p.firstQuestion.expression).toBeTruthy()
  })
})

// ==================== buildQuestionPayload ====================

describe('buildQuestionPayload', () => {
  it('算术含 expression', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    const q = gameManager.createNextQuestion(ROOM_ID)
    const p = gameManager.buildQuestionPayload(ROOM_ID, q)
    expect(p.expression).toBeTruthy()
    expect(p.questionId).toBe(q.questionId)
  })

  it('默写含 ttsText/blanks', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'spelling', 'easy')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2]))
    const q = gameManager.createNextQuestion(ROOM_ID)
    const p = gameManager.buildQuestionPayload(ROOM_ID, q)
    expect(p.ttsText).toBeTruthy()
    expect(p.blanks).toBeTruthy()
  })
})

// ==================== buildPlayerRoundResultPayload ====================

describe('buildPlayerRoundResultPayload', () => {
  it('RPS 含 yourMove/oppMove', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    gameManager.submitInput(ROOM_ID, P1, { choice: 'rock' })
    const result = gameManager.submitInput(ROOM_ID, P2, { choice: 'scissors' })
    const p = gameManager.buildPlayerRoundResultPayload(ROOM_ID, P1, result.result)
    expect(p.yourMove).toBe('rock')
    expect(p.oppMove).toBe('scissors')
  })
})

// ==================== buildMatchResultPayload ====================

describe('buildMatchResultPayload', () => {
  it('RPS matchResult 不包含 ranking', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    gameManager.submitInput(ROOM_ID, P1, { choice: 'rock' })
    gameManager.submitInput(ROOM_ID, P2, { choice: 'scissors' })
    gameManager.submitInput(ROOM_ID, P1, { choice: 'rock' })
    const result = gameManager.submitInput(ROOM_ID, P2, { choice: 'scissors' })
    const p = gameManager.buildMatchResultPayload(ROOM_ID, result.result)
    expect(p.ranking).toBeUndefined()
  })
})

// ==================== createNextQuestion ====================

describe('createNextQuestion', () => {
  it('RPS 返回 null', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    expect(gameManager.createNextQuestion(ROOM_ID)).toBeNull()
  })

  it('算术返回新题目', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    const q = gameManager.createNextQuestion(ROOM_ID)
    expect(q.questionId).toBeTruthy()
    expect(q.expression).toBeTruthy()
  })
})
