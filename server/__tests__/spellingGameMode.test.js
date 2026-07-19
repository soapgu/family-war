/**
 * v3.1 Phase 1 重构 — SpellingGameMode 单元测试。
 *
 * 覆盖：
 * - createGame（默认/自定义 difficulty）
 * - createNextQuestion（词库取词 / 不重复 / 空词库错误）
 * - generateBlanks（easy/normal/hard / 空格分隔 ·）
 * - normalizeAnswer / validateAnswer（空字符串 / 非字符串类型拒绝）
 * - isCorrectAnswer（大小写不敏感）
 * - buildStartPayload / buildQuestionPayload / buildPlayerRoundResultPayload / buildMatchResultPayload
 * - getRobotDelayMs（easy / hard 区分）
 * - getRobotScheduleAfterWaiting（全部人类答完加速 / 未答完 null）
 * - handleRobotInput 完整流程（正确 / 过期 / 5 分赛果）
 */
const SpellingGameMode = require('../src/socket/games/SpellingGameMode')

const ROBOT_ID = '__robot__'
const P1 = 'p1'
const P2 = 'p2'

function wordBankMock(words = ['classroom', 'library', 'garden']) {
  return { getActiveWords: jest.fn(() => [...words]) }
}

function unsplashMock() {
  return { getImageUrl: jest.fn(() => 'https://images.unsplash.com/photo-abc') }
}

function createMode({ config = {}, words } = {}) {
  return new SpellingGameMode({
    type: 'spelling',
    config,
    roomManager: { ROBOT_ID },
    wordBank: wordBankMock(words),
    unsplashClient: unsplashMock(),
  })
}

function makeGame(mode, playerIds) {
  const game = mode.createGame({ roomId: 'r1', playerIds, difficulty: 'easy' })
  return game
}

describe('createGame', () => {
  it('使用默认 difficulty easy', () => {
    const mode = createMode()
    const game = mode.createGame({ roomId: 'r1', playerIds: [P1, P2] })
    expect(game.difficulty).toBe('easy')
    expect(game.usedWords).toEqual([])
  })

  it('接受自定义 difficulty', () => {
    const mode = createMode()
    const game = mode.createGame({ roomId: 'r1', playerIds: [P1, P2], difficulty: 'hard' })
    expect(game.difficulty).toBe('hard')
  })
})

describe('createNextQuestion', () => {
  it('从词库取词生成题目', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    const q = mode.createNextQuestion({ game })
    expect(q.questionId).toContain('q_')
    expect(q.word).toBeTruthy()
    expect(q.blanks).toBeTruthy()
    expect(q.wordLength).toBe(q.word.length)
    expect(q.unsplashImageUrl).toContain('https://')
    expect(game.currentQuestion).toBe(q)
  })

  it('重复取词不重复直到词库用完再循环', () => {
    const mode = createMode({ words: ['apple', 'banana'] })
    const game = makeGame(mode, [P1, P2])
    const q1 = mode.createNextQuestion({ game })
    const q2 = mode.createNextQuestion({ game })
    const q3 = mode.createNextQuestion({ game })
    expect(q1.word).not.toBe(q2.word)
    expect(q3.word).toBeTruthy()
  })

  it('空词库抛出错误', () => {
    const mode = createMode({ words: [] })
    const game = makeGame(mode, [P1, P2])
    expect(() => mode.createNextQuestion({ game })).toThrow('当前没有可用的默写单词')
  })
})

describe('generateBlanks', () => {
  it('easy 暴露 ceil(50%) 个字母', () => {
    const mode = createMode()
    const blanks = mode.generateBlanks('apple', 'easy')
    const shown = blanks.split(' ').filter((ch) => ch !== '_' && ch !== '·').length
    expect(shown).toBe(Math.ceil(5 * 0.5))
  })

  it('hard 全部隐藏', () => {
    const mode = createMode()
    const blanks = mode.generateBlanks('apple', 'hard')
    expect(blanks.split(' ').filter((ch) => ch !== '_').length).toBe(0)
  })

  it('空格用 · 分隔', () => {
    const mode = createMode()
    const blanks = mode.generateBlanks('art room', 'hard')
    expect(blanks).toContain('·')
  })
})

describe('normalizeAnswer', () => {
  it('收尾空白后返回字符串', () => {
    const mode = createMode()
    expect(mode.normalizeAnswer('  Hello  ')).toBe('Hello')
  })

  it('null/undefined 保持原类型不转字符串', () => {
    const mode = createMode()
    expect(mode.normalizeAnswer(null)).toBeNull()
    expect(mode.normalizeAnswer(undefined)).toBeUndefined()
  })
})

describe('validateAnswer', () => {
  it('空字符串返回 error', () => {
    const mode = createMode()
    const r = mode.validateAnswer('')
    expect(r).toEqual({ action: 'error', message: '答案必须是非空字符串' })
  })

  it('非空返回 null', () => {
    const mode = createMode()
    expect(mode.validateAnswer('hello')).toBeNull()
  })

  it('非字符串返回 error', () => {
    const mode = createMode()
    const r = mode.validateAnswer(123)
    expect(r.action).toBe('error')
    expect(r.message).toBe('答案必须是非空字符串')
  })
})

describe('isCorrectAnswer', () => {
  it('大小写不敏感', () => {
    const mode = createMode()
    expect(mode.isCorrectAnswer({ word: 'Apple' }, 'apple')).toBe(true)
    expect(mode.isCorrectAnswer({ word: 'Apple' }, 'APPLE')).toBe(true)
    expect(mode.isCorrectAnswer({ word: 'Apple' }, 'orange')).toBe(false)
  })
})

describe('buildWrongAnswerAck', () => {
  it('含 correctAnswer/word/yourAnswer', () => {
    const mode = createMode()
    const ack = mode.buildWrongAnswerAck({ question: { word: 'apple' }, answer: 'aple' })
    expect(ack.correctAnswer).toBe('apple')
    expect(ack.word).toBe('apple')
    expect(ack.yourAnswer).toBe('aple')
  })
})

describe('buildStartPayload', () => {
  it('含 gameType/players/round/difficulty/firstQuestion', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    const room = { players: { [P1]: { nickname: '小明' }, [P2]: { nickname: '小红' } } }
    const firstQuestion = mode.createNextQuestion({ game })
    const p = mode.buildStartPayload({ game, room, firstQuestion })
    expect(p.gameType).toBe('spelling')
    expect(p.players).toHaveLength(2)
    expect(p.difficulty).toBe('easy')
    expect(p.firstQuestion.ttsText).toBe(firstQuestion.word)
  })
})

describe('buildQuestionPayload', () => {
  it('含 questionId/ttsText/wordLength/blanks/unsplashImageUrl/round', () => {
    const mode = createMode()
    const q = { questionId: 'q1', word: 'library', wordLength: 7, blanks: 'l _ b r _ r y', unsplashImageUrl: 'https://img.com/1', round: 1 }
    const p = mode.buildQuestionPayload({ question: q })
    expect(p.ttsText).toBe('library')
    expect(p.wordLength).toBe(7)
    expect(p.blanks).toBe('l _ b r _ r y')
    expect(p.unsplashImageUrl).toBe('https://img.com/1')
  })
})

describe('buildPlayerRoundResultPayload', () => {
  it('含 word/blanks 字段', () => {
    const mode = createMode()
    const result = { round: 1, questionId: 'q1', word: 'library', blanks: 'l _ b r _ r y', correctAnswer: 'library', winner: P1, scores: { [P1]: 1, [P2]: 0 }, answeredBy: { [P1]: 'library' } }
    const p = mode.buildPlayerRoundResultPayload({ result, playerId: P1 })
    expect(p.word).toBe('library')
    expect(p.blanks).toBe('l _ b r _ r y')
    expect(p.gameType).toBe('spelling')
  })
})

describe('buildMatchResultPayload', () => {
  it('含 ranking 排行榜', () => {
    const mode = createMode()
    const result = { matchWinner: P1, scores: { [P1]: 5, [P2]: 2 }, ranking: [{ rank: 1, playerId: P1, score: 5 }], history: [] }
    const p = mode.buildMatchResultPayload({ result })
    expect(p.gameType).toBe('spelling')
    expect(p.ranking).toHaveLength(1)
  })
})

describe('getRobotDelayMs', () => {
  it('easy 返回 40000', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    expect(mode.getRobotDelayMs({ game })).toBe(40000)
  })

  it('hard 返回 20000', () => {
    const mode = createMode({
      config: {
        difficulties: {
          easy: { questionTimeLimitMs: 40000, robotAnswerDelayMs: 40000 },
          normal: { questionTimeLimitMs: 30000, robotAnswerDelayMs: 30000 },
          hard: { questionTimeLimitMs: 20000, robotAnswerDelayMs: 20000 },
        },
      },
    })
    const game = mode.createGame({ roomId: 'r1', playerIds: [P1, P2], difficulty: 'hard' })
    expect(mode.getRobotDelayMs({ game })).toBe(20000)
  })
})

describe('getRobotAnswer', () => {
  it('返回 question.word', () => {
    const mode = createMode()
    expect(mode.getRobotAnswer({ word: 'apple' })).toBe('apple')
  })
})

describe('getRobotScheduleAfterWaiting', () => {
  it('有人类未答时返回 null', () => {
    const mode = createMode()
    expect(mode.getRobotScheduleAfterWaiting({ allHumansAnswered: false })).toBeNull()
  })

  it('全部人类答完返回加速意图', () => {
    const mode = createMode()
    const r = mode.getRobotScheduleAfterWaiting({ allHumansAnswered: true })
    expect(r).toEqual({ action: 'accelerate', delayMs: 5000, onlyIfRemainingGreaterThanMs: 5000 })
  })
})

describe('handleRobotInput（完整流程）', () => {
  it('机器人提交正确答案返回 round_result', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, ROBOT_ID])
    const q = mode.createNextQuestion({ game })
    const room = { players: { [P1]: { nickname: '小明' }, [ROBOT_ID]: { nickname: '机器人' } } }
    const result = mode.handleRobotInput({ room, game, robotId: ROBOT_ID, questionId: q.questionId })
    expect(result.action).toBe('round_result')
    expect(result.result.winner).toBe(ROBOT_ID)
  })

  it('过期题目返回 null', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, ROBOT_ID])
    const q = mode.createNextQuestion({ game })
    game.currentQuestion = null
    const result = mode.handleRobotInput({ room: {}, game, robotId: ROBOT_ID, questionId: q.questionId })
    expect(result).toBeNull()
  })

  it('机器人先到 5 分触发 match_result', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, ROBOT_ID])
    const room = { players: { [P1]: { nickname: '小明' }, [ROBOT_ID]: { nickname: '机器人' } } }
    for (let i = 0; i < 5; i++) {
      const q = mode.createNextQuestion({ game })
      const r = mode.handleRobotInput({ room, game, robotId: ROBOT_ID, questionId: q.questionId })
      if (r?.action === 'match_result') {
        expect(r.result.matchWinner).toBe(ROBOT_ID)
        expect(r.result.scores[ROBOT_ID]).toBe(5)
        return
      }
    }
    expect(true).toBe(false)
  })
})
