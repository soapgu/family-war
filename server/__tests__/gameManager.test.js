jest.mock('../src/socket/roomManager', () => ({
  setGame: jest.fn(),
  clearGame: jest.fn(),
  getRoom: jest.fn(),
  ROBOT_ID: '__robot__',
}))

const roomManager = require('../src/socket/roomManager')
const gameManager = require('../src/socket/gameManager')

const ROOM_ID = 'default'
const P1 = 's1'
const P2 = 's2'
const P3 = 's3'
const ROBOT = '__robot__'

/**
 * 创建一个可用的 mock room（包含 game）
 */
function mockRoom(game) {
  return {
    id: ROOM_ID,
    players: {},
    roles: {},
    game: game || null,
  }
}

/**
 * 为算术测试创建 room，包含 players 中的昵称信息
 */
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

// ==================== submitMove ====================

describe('submitMove', () => {
  /** 创建一个新 game 并注入到 mock room 中 */
  function startGame() {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
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
    expect(result.winner).toBe('draw')
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

    const game = gameManager.getGame(ROOM_ID)
    expect(game).not.toBeNull()
    expect(game.status).toBe('match_end')
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
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
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
    const g1 = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
    roomManager.getRoom.mockReturnValue(mockRoom(g1))
    gameManager.submitMove(ROOM_ID, P1, 'rock')
    gameManager.submitMove(ROOM_ID, P2, 'scissors')
    gameManager.submitMove(ROOM_ID, P1, 'paper')
    gameManager.submitMove(ROOM_ID, P2, 'rock')

    // 第 2 场
    const g2 = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
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

describe('generateQuestion', () => {
  function startArithmeticGame() {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    return game
  }

  it('生成题目并附加到 game 对象', () => {
    const game = startArithmeticGame()
    const question = gameManager.generateQuestion(game)

    expect(question).toHaveProperty('questionId')
    expect(question).toHaveProperty('expression')
    expect(question).toHaveProperty('correctAnswer')
    expect(question).toHaveProperty('round')
    expect(question.round).toBe(1)
    expect(typeof question.correctAnswer).toBe('number')
    expect(game.currentQuestion).toBe(question)
    expect(game.answeredThisRound).toEqual({})
  })

  it('题目表达式格式正确', () => {
    const game = startArithmeticGame()
    const question = gameManager.generateQuestion(game)

    expect(question.expression).toMatch(/^\d+ [+\-] \d+$/)
  })

  it('题目的正确结果在 0-100 范围内', () => {
    const game = startArithmeticGame()
    for (let i = 0; i < 50; i++) {
      game.currentQuestion = null
      const question = gameManager.generateQuestion(game)
      expect(question.correctAnswer).toBeGreaterThanOrEqual(0)
      expect(question.correctAnswer).toBeLessThanOrEqual(100)
    }
  })
})

describe('submitArithmeticAnswer', () => {
  function startArithmeticGame() {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2]))
    return game
  }

  function startWithQuestion() {
    const game = startArithmeticGame()
    const question = gameManager.generateQuestion(game)
    return { game, question }
  }

  it('正确答案返回 round_result', () => {
    const { question } = startWithQuestion()
    const result = gameManager.submitArithmeticAnswer(ROOM_ID, P1, question.questionId, question.correctAnswer)

    expect(result.action).toBe('round_result')
    expect(result.winner).toBe(P1)
    expect(result.round).toBe(1)
    expect(result.questionId).toBe(question.questionId)
    expect(result.expression).toBe(question.expression)
    expect(result.correctAnswer).toBe(question.correctAnswer)
    expect(result.scores[P1]).toBe(1)
    expect(result.scores[P2]).toBe(0)
  })

  it('错误答案返回 waiting', () => {
    const { question } = startWithQuestion()
    const wrongAnswer = question.correctAnswer + 1
    const result = gameManager.submitArithmeticAnswer(ROOM_ID, P1, question.questionId, wrongAnswer)

    expect(result.action).toBe('waiting')
  })

  it('非本局玩家返回 error', () => {
    const { question } = startWithQuestion()
    const result = gameManager.submitArithmeticAnswer(ROOM_ID, 's99', question.questionId, 42)

    expect(result.action).toBe('error')
    expect(result.message).toBe('你不是本局玩家')
  })

  it('重复回答返回 error', () => {
    const { question } = startWithQuestion()
    gameManager.submitArithmeticAnswer(ROOM_ID, P1, question.questionId, question.correctAnswer + 1)
    const result = gameManager.submitArithmeticAnswer(ROOM_ID, P1, question.questionId, question.correctAnswer)

    expect(result.action).toBe('error')
    expect(result.message).toBe('你已经回答过本题')
  })

  it('过期的 questionId 返回 error', () => {
    const { question } = startWithQuestion()
    gameManager.submitArithmeticAnswer(ROOM_ID, P1, question.questionId, question.correctAnswer)

    const result = gameManager.submitArithmeticAnswer(ROOM_ID, P2, question.questionId, question.correctAnswer)
    expect(result.action).toBe('error')
    expect(result.message).toBe('题目已过期')
  })

  it('比赛结束后返回 error', () => {
    const { question } = startWithQuestion()
    const game = gameManager.getGame(ROOM_ID)
    game.status = 'match_end'

    const result = gameManager.submitArithmeticAnswer(ROOM_ID, P1, question.questionId, question.correctAnswer)
    expect(result.action).toBe('error')
    expect(result.message).toBe('比赛已结束')
  })

  it('不存在的算术游戏返回 error', () => {
    roomManager.getRoom.mockReturnValue(null)
    const result = gameManager.submitArithmeticAnswer(ROOM_ID, P1, 'q1', 42)
    expect(result.action).toBe('error')
    expect(result.message).toBe('算术游戏不存在')
  })

  it('正确答案后清除 currentQuestion', () => {
    const { question } = startWithQuestion()
    gameManager.submitArithmeticAnswer(ROOM_ID, P1, question.questionId, question.correctAnswer)

    const game = gameManager.getGame(ROOM_ID)
    expect(game.currentQuestion).toBeNull()
  })

  it('首位答对者得分，其余不得分', () => {
    const { game, question } = startWithQuestion()
    const wrongAnswer = question.correctAnswer + 1

    // P1 先答错
    gameManager.submitArithmeticAnswer(ROOM_ID, P1, question.questionId, wrongAnswer)
    // P2 答对
    const result = gameManager.submitArithmeticAnswer(ROOM_ID, P2, question.questionId, question.correctAnswer)

    expect(result.winner).toBe(P2)
    expect(result.scores[P2]).toBe(1)
    expect(result.scores[P1]).toBe(0)
    expect(game.history).toHaveLength(1)
    expect(game.history[0].winner).toBe(P2)
  })

  it('answeredBy 记录所有已答玩家', () => {
    const { question } = startWithQuestion()
    const wrongAnswer = question.correctAnswer + 1

    // P1 答错 → P2 答对
    gameManager.submitArithmeticAnswer(ROOM_ID, P1, question.questionId, wrongAnswer)
    const result = gameManager.submitArithmeticAnswer(ROOM_ID, P2, question.questionId, question.correctAnswer)

    expect(result.answeredBy).toMatchObject({
      [P1]: wrongAnswer,
      [P2]: question.correctAnswer,
    })
  })
})

describe('算术 5 分赛制', () => {
  /** 模拟 P1 连续正确 n 次，每题生成新题目 */
  function simulateCorrectAnswers(count) {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2]))

    for (let i = 0; i < count; i++) {
      game.currentQuestion = null
      const question = gameManager.generateQuestion(game)
      const result = gameManager.submitArithmeticAnswer(ROOM_ID, P1, question.questionId, question.correctAnswer)
      if (result.action === 'match_result') return result
    }
    return null
  }

  it('4 分时返回 round_result（未到赛点）', () => {
    const result = simulateCorrectAnswers(4)
    expect(result).toBeNull()
    const game = gameManager.getGame(ROOM_ID)
    expect(game.status).toBe('playing')
  })

  it('先得 5 分者获胜，返回 match_result', () => {
    const result = simulateCorrectAnswers(5)

    expect(result.action).toBe('match_result')
    expect(result.matchWinner).toBe(P1)
    expect(result.scores[P1]).toBe(5)
    expect(result.scores[P2]).toBe(0)
  })

  it('match_result 包含排行榜', () => {
    const result = simulateCorrectAnswers(5)

    expect(result.ranking).toBeDefined()
    expect(result.ranking[0].rank).toBe(1)
    expect(result.ranking[0].playerId).toBe(P1)
    expect(result.ranking[0].score).toBe(5)
    expect(result.ranking).toHaveLength(2)
  })

  it('match_result 包含完整历史', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2]))

    for (let i = 0; i < 5; i++) {
      game.currentQuestion = null
      const q = gameManager.generateQuestion(game)
      const result = gameManager.submitArithmeticAnswer(ROOM_ID, P1, q.questionId, q.correctAnswer)
      if (i === 4) {
        expect(result.history).toHaveLength(5)
        result.history.forEach((h, idx) => {
          expect(h.round).toBe(idx + 1)
          expect(h.winner).toBe(P1)
        })
      }
    }
  })

  it('比赛结束后 game.status 为 match_end', () => {
    simulateCorrectAnswers(5)
    const game = gameManager.getGame(ROOM_ID)
    expect(game.status).toBe('match_end')
  })

  it('历史记录存入 matchHistory', () => {
    simulateCorrectAnswers(5)

    const history = gameManager.getMatchHistory()
    expect(history).toHaveLength(1)
    expect(history[0].type).toBe('arithmetic')
    expect(history[0].matchWinner).toBe(P1)
    expect(history[0].scores[P1]).toBe(5)
    expect(typeof history[0].endedAt).toBe('number')
  })
})

describe('handleRobotArithmeticAnswer', () => {
  function startWithQuestion() {
    const game = gameManager.createGame(ROOM_ID, [P1, ROBOT], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, ROBOT]))
    const question = gameManager.generateQuestion(game)
    return { game, question }
  }

  it('机器人提交正确答案返回 round_result', () => {
    const { question } = startWithQuestion()
    const result = gameManager.handleRobotArithmeticAnswer(ROOM_ID, question.questionId)

    expect(result).not.toBeNull()
    expect(result.action).toBe('round_result')
    expect(result.winner).toBe(ROBOT)
    expect(result.scores[ROBOT]).toBe(1)
  })

  it('过期题目返回 null', () => {
    const { question } = startWithQuestion()
    gameManager.submitArithmeticAnswer(ROOM_ID, P1, question.questionId, question.correctAnswer)

    const result = gameManager.handleRobotArithmeticAnswer(ROOM_ID, question.questionId)
    expect(result).toBeNull()
  })

  it('RPS 游戏返回 null', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'rps')
    roomManager.getRoom.mockReturnValue(mockRoom(game))

    const result = gameManager.handleRobotArithmeticAnswer(ROOM_ID, 'q1')
    expect(result).toBeNull()
  })

  it('机器人先到 5 分触发 match_result', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, ROBOT], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, ROBOT]))

    for (let i = 0; i < 5; i++) {
      game.currentQuestion = null
      const q = gameManager.generateQuestion(game)
      const result = gameManager.handleRobotArithmeticAnswer(ROOM_ID, q.questionId)
      if (result.action === 'match_result') {
        expect(result.matchWinner).toBe(ROBOT)
        expect(result.scores[ROBOT]).toBe(5)
        return
      }
    }
    // Should not reach here
    expect(true).toBe(false)
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

describe('generateBlanks', () => {
  it('hard 难度全部隐藏', () => {
    const blanks = gameManager.generateBlanks('apple', 'hard')
    expect(blanks).toBe('_ _ _ _ _')
  })

  it('easy 难度暴露约 50% 字母', () => {
    const blanks = gameManager.generateBlanks('elephant', 'easy')
    const shown = blanks.split(' ').filter((ch) => ch !== '_')
    expect(shown.length).toBeGreaterThanOrEqual(2)
    expect(shown.length).toBeLessThanOrEqual(5)
  })

  it('normal 难度暴露 1-2 个字母', () => {
    for (let i = 0; i < 20; i++) {
      const blanks = gameManager.generateBlanks('garden', 'normal')
      const shown = blanks.split(' ').filter((ch) => ch !== '_')
      expect(shown.length).toBeGreaterThanOrEqual(1)
      expect(shown.length).toBeLessThanOrEqual(2)
    }
  })

  it('空格格式正确（字母和 _ 之间空格分隔）', () => {
    const blanks = gameManager.generateBlanks('cat', 'easy')
    expect(blanks).toMatch(/^[_a-z]( [_a-z]){2}$/)
  })

  it('暴露的字母与原始单词对应位置一致', () => {
    const blanks = gameManager.generateBlanks('fish', 'easy')
    const parts = blanks.split(' ')
    parts.forEach((ch, i) => {
      if (ch !== '_') {
        expect(ch).toBe('fish'[i])
      }
    })
  })
})

describe('generateSpellingQuestion', () => {
  function startSpellingGame(difficulty) {
    return gameManager.createGame(ROOM_ID, [P1, P2], 'spelling', difficulty)
  }

  it('生成题目包含必要字段', () => {
    const game = startSpellingGame('easy')
    const question = gameManager.generateSpellingQuestion(game)

    expect(question).toHaveProperty('questionId')
    expect(question).toHaveProperty('word')
    expect(question).toHaveProperty('wordLength')
    expect(question).toHaveProperty('blanks')
    expect(question).toHaveProperty('unsplashImageUrl')
    expect(question).toHaveProperty('round')
    expect(question.round).toBe(1)
    expect(question.wordLength).toBe(question.word.length)
    expect(game.currentQuestion).toBe(question)
    expect(game.answeredThisRound).toEqual({})
  })

  it('题目在 words.json 词库中', () => {
    const game = startSpellingGame('easy')
    const words = require('../src/data/words.json')
    const question = gameManager.generateSpellingQuestion(game)
    expect(words).toContain(question.word)
  })

  it('blanks 长度与单词一致', () => {
    const game = startSpellingGame('easy')
    const question = gameManager.generateSpellingQuestion(game)
    const parts = question.blanks.split(' ')
    expect(parts).toHaveLength(question.wordLength)
  })
})

describe('submitSpellingAnswer', () => {
  function startSpellingGame(difficulty) {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'spelling', difficulty)
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2]))
    return game
  }

  function startWithQuestion(difficulty = 'easy') {
    const game = startSpellingGame(difficulty)
    const question = gameManager.generateSpellingQuestion(game)
    return { game, question }
  }

  it('正确答案返回 round_result', () => {
    const { question } = startWithQuestion()
    const result = gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, question.word)

    expect(result.action).toBe('round_result')
    expect(result.winner).toBe(P1)
    expect(result.round).toBe(1)
    expect(result.questionId).toBe(question.questionId)
    expect(result.word).toBe(question.word)
    expect(result.correctAnswer).toBe(question.word)
    expect(result.scores[P1]).toBe(1)
    expect(result.scores[P2]).toBe(0)
  })

  it('大小写不敏感', () => {
    const { question } = startWithQuestion()
    const result = gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, question.word.toUpperCase())
    expect(result.action).toBe('round_result')
    expect(result.winner).toBe(P1)
  })

  it('错误答案返回 waiting', () => {
    const { question } = startWithQuestion()
    const result = gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, 'wrongword')

    expect(result.action).toBe('waiting')
    expect(result.correctAnswer).toBe(question.word)
    expect(result.yourAnswer).toBe('wrongword')
  })

  it('非本局玩家返回 error', () => {
    const { question } = startWithQuestion()
    const result = gameManager.submitSpellingAnswer(ROOM_ID, 's99', question.questionId, 'test')
    expect(result.action).toBe('error')
    expect(result.message).toBe('你不是本局玩家')
  })

  it('重复回答返回 error', () => {
    const { question } = startWithQuestion()
    gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, 'wrong')
    const result = gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, question.word)
    expect(result.action).toBe('error')
    expect(result.message).toBe('你已经回答过本题')
  })

  it('过期的 questionId 返回 error', () => {
    const { question } = startWithQuestion()
    gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, question.word)
    const result = gameManager.submitSpellingAnswer(ROOM_ID, P2, question.questionId, question.word)
    expect(result.action).toBe('error')
    expect(result.message).toBe('题目已过期')
  })

  it('比赛结束后返回 error', () => {
    const { question } = startWithQuestion()
    const game = gameManager.getGame(ROOM_ID)
    game.status = 'match_end'
    const result = gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, question.word)
    expect(result.action).toBe('error')
    expect(result.message).toBe('比赛已结束')
  })

  it('不存在的默写游戏返回 error', () => {
    roomManager.getRoom.mockReturnValue(null)
    const result = gameManager.submitSpellingAnswer(ROOM_ID, P1, 'q1', 'test')
    expect(result.action).toBe('error')
    expect(result.message).toBe('默写游戏不存在')
  })

  it('正确答案后清除 currentQuestion', () => {
    const { question } = startWithQuestion()
    gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, question.word)
    const game = gameManager.getGame(ROOM_ID)
    expect(game.currentQuestion).toBeNull()
  })

  it('首位答对者得分，其余不得分', () => {
    const { game, question } = startWithQuestion()
    gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, 'wrong')
    const result = gameManager.submitSpellingAnswer(ROOM_ID, P2, question.questionId, question.word)

    expect(result.winner).toBe(P2)
    expect(result.scores[P2]).toBe(1)
    expect(result.scores[P1]).toBe(0)
    expect(game.history).toHaveLength(1)
    expect(game.history[0].winner).toBe(P2)
  })

  it('answeredBy 记录所有已答玩家', () => {
    const { question } = startWithQuestion()
    gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, 'wrong')
    const result = gameManager.submitSpellingAnswer(ROOM_ID, P2, question.questionId, question.word)

    expect(result.answeredBy).toMatchObject({
      [P1]: 'wrong',
      [P2]: question.word,
    })
  })

  it('历史记录包含 word 和 blanks', () => {
    const { game, question } = startWithQuestion()
    gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, question.word)

    expect(game.history[0].word).toBe(question.word)
    expect(game.history[0].blanks).toBe(question.blanks)
    expect(game.history[0].correctAnswer).toBe(question.word)
  })
})

describe('默写 5 分赛制', () => {
  function simulateCorrectAnswers(count) {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'spelling', 'easy')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2]))

    for (let i = 0; i < count; i++) {
      game.currentQuestion = null
      const question = gameManager.generateSpellingQuestion(game)
      const result = gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, question.word)
      if (result.action === 'match_result') return result
    }
    return null
  }

  it('4 分时返回 round_result（未到赛点）', () => {
    const result = simulateCorrectAnswers(4)
    expect(result).toBeNull()
    const game = gameManager.getGame(ROOM_ID)
    expect(game.status).toBe('playing')
  })

  it('先得 5 分者获胜，返回 match_result', () => {
    const result = simulateCorrectAnswers(5)
    expect(result.action).toBe('match_result')
    expect(result.matchWinner).toBe(P1)
    expect(result.scores[P1]).toBe(5)
    expect(result.scores[P2]).toBe(0)
  })

  it('match_result 包含排行榜', () => {
    const result = simulateCorrectAnswers(5)
    expect(result.ranking).toBeDefined()
    expect(result.ranking[0].rank).toBe(1)
    expect(result.ranking[0].playerId).toBe(P1)
    expect(result.ranking[0].score).toBe(5)
    expect(result.ranking).toHaveLength(2)
  })

  it('match_result 包含完整历史', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'spelling', 'easy')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, P2]))

    for (let i = 0; i < 5; i++) {
      game.currentQuestion = null
      const q = gameManager.generateSpellingQuestion(game)
      const result = gameManager.submitSpellingAnswer(ROOM_ID, P1, q.questionId, q.word)
      if (i === 4) {
        expect(result.history).toHaveLength(5)
        result.history.forEach((h, idx) => {
          expect(h.round).toBe(idx + 1)
          expect(h.winner).toBe(P1)
        })
      }
    }
  })

  it('比赛结束后 game.status 为 match_end', () => {
    simulateCorrectAnswers(5)
    const game = gameManager.getGame(ROOM_ID)
    expect(game.status).toBe('match_end')
  })

  it('历史记录存入 matchHistory', () => {
    simulateCorrectAnswers(5)
    const history = gameManager.getMatchHistory()
    expect(history).toHaveLength(1)
    expect(history[0].type).toBe('spelling')
    expect(history[0].matchWinner).toBe(P1)
    expect(history[0].scores[P1]).toBe(5)
    expect(typeof history[0].endedAt).toBe('number')
  })
})

describe('handleRobotSpellingAnswer', () => {
  function startWithQuestion() {
    const game = gameManager.createGame(ROOM_ID, [P1, ROBOT], 'spelling', 'easy')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, ROBOT]))
    const question = gameManager.generateSpellingQuestion(game)
    return { game, question }
  }

  it('机器人提交正确答案返回 round_result', () => {
    const { question } = startWithQuestion()
    const result = gameManager.handleRobotSpellingAnswer(ROOM_ID, question.questionId)

    expect(result).not.toBeNull()
    expect(result.action).toBe('round_result')
    expect(result.winner).toBe(ROBOT)
    expect(result.scores[ROBOT]).toBe(1)
  })

  it('过期题目返回 null', () => {
    const { question } = startWithQuestion()
    gameManager.submitSpellingAnswer(ROOM_ID, P1, question.questionId, question.word)
    const result = gameManager.handleRobotSpellingAnswer(ROOM_ID, question.questionId)
    expect(result).toBeNull()
  })

  it('算术游戏返回 null', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, P2], 'arithmetic')
    roomManager.getRoom.mockReturnValue(mockRoom(game))
    const result = gameManager.handleRobotSpellingAnswer(ROOM_ID, 'q1')
    expect(result).toBeNull()
  })

  it('机器人先到 5 分触发 match_result', () => {
    const game = gameManager.createGame(ROOM_ID, [P1, ROBOT], 'spelling', 'easy')
    roomManager.getRoom.mockReturnValue(mockRoomWithPlayers(game, [P1, ROBOT]))

    for (let i = 0; i < 5; i++) {
      game.currentQuestion = null
      const q = gameManager.generateSpellingQuestion(game)
      const result = gameManager.handleRobotSpellingAnswer(ROOM_ID, q.questionId)
      if (result.action === 'match_result') {
        expect(result.matchWinner).toBe(ROBOT)
        expect(result.scores[ROBOT]).toBe(5)
        return
      }
    }
    expect(true).toBe(false)
  })
})
