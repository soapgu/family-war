const ArithmeticGameMode = require('../src/socket/games/ArithmeticGameMode')

const ROBOT_ID = '__robot__'
const P1 = 'p1'
const P2 = 'p2'

function createMode(config = {}) {
  return new ArithmeticGameMode({ type: 'arithmetic', config, roomManager: { ROBOT_ID } })
}

function makeGame(mode, playerIds) {
  const game = mode.createGame({ roomId: 'r1', playerIds })
  return game
}

describe('createNextQuestion', () => {
  it('表达式格式正确', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    const q = mode.createNextQuestion({ game })
    expect(q.expression).toMatch(/^\d+ [\+\-] \d+$/)
    expect(typeof q.correctAnswer).toBe('number')
    expect(q.correctAnswer).toBeGreaterThanOrEqual(0)
    expect(q.correctAnswer).toBeLessThanOrEqual(100)
    expect(q.questionId).toContain('q_')
    expect(q.round).toBe(1)
    expect(game.currentQuestion).toBe(q)
  })

  it('每个题目独立不重复', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    const q1 = mode.createNextQuestion({ game })
    const origNow = Date.now
    Date.now = () => origNow() + 1000
    const q2 = mode.createNextQuestion({ game })
    Date.now = origNow
    expect(q1.questionId).not.toBe(q2.questionId)
  })
})

describe('normalizeAnswer', () => {
  it('字符串数字转为 Number', () => {
    const mode = createMode()
    expect(mode.normalizeAnswer('42')).toBe(42)
  })
})

describe('validateAnswer', () => {
  it('非数字返回 error', () => {
    const mode = createMode()
    const r = mode.validateAnswer(NaN)
    expect(r).toEqual({ action: 'error', message: '答案必须是有效数字' })
  })

  it('Infinity 返回 error', () => {
    const mode = createMode()
    expect(mode.validateAnswer(Infinity).action).toBe('error')
  })

  it('有效数字返回 null', () => {
    const mode = createMode()
    expect(mode.validateAnswer(42)).toBeNull()
  })
})

describe('isCorrectAnswer', () => {
  it('数字匹配返回 true', () => {
    const mode = createMode()
    expect(mode.isCorrectAnswer({ correctAnswer: 42 }, 42)).toBe(true)
    expect(mode.isCorrectAnswer({ correctAnswer: 42 }, 43)).toBe(false)
  })
})

describe('buildWrongAnswerAck', () => {
  it('含 correctAnswer/expression/yourAnswer', () => {
    const mode = createMode()
    const ack = mode.buildWrongAnswerAck({ question: { expression: '1 + 2', correctAnswer: 3 }, answer: 5 })
    expect(ack.correctAnswer).toBe(3)
    expect(ack.expression).toBe('1 + 2')
    expect(ack.yourAnswer).toBe(5)
  })
})

describe('buildStartPayload', () => {
  it('含 gameType/players/round/firstQuestion', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    const room = { players: { [P1]: { nickname: '小明' }, [P2]: { nickname: '小红' } } }
    const firstQuestion = mode.createNextQuestion({ game })
    const p = mode.buildStartPayload({ game, room, firstQuestion })
    expect(p.gameType).toBe('arithmetic')
    expect(p.players).toHaveLength(2)
    expect(p.round).toBe(1)
    expect(p.firstQuestion.questionId).toBe(firstQuestion.questionId)
    expect(p.firstQuestion.expression).toBeTruthy()
  })
})

describe('buildQuestionPayload', () => {
  it('含 questionId/expression/round', () => {
    const mode = createMode()
    const q = { questionId: 'q1', expression: '1 + 2', round: 1 }
    const p = mode.buildQuestionPayload({ question: q })
    expect(p.questionId).toBe('q1')
    expect(p.expression).toBe('1 + 2')
    expect(p.round).toBe(1)
  })
})

describe('buildPlayerRoundResultPayload', () => {
  it('含游戏类型/轮次/表达式/正确答案/得分', () => {
    const mode = createMode()
    const result = { round: 1, questionId: 'q1', expression: '1 + 2', correctAnswer: 3, winner: P1, scores: { [P1]: 1, [P2]: 0 }, answeredBy: { [P1]: 3 } }
    const p = mode.buildPlayerRoundResultPayload({ result, playerId: P1 })
    expect(p.gameType).toBe('arithmetic')
    expect(p.round).toBe(1)
    expect(p.expression).toBe('1 + 2')
    expect(p.correctAnswer).toBe(3)
    expect(p.yourAnswer).toBe(3)
    expect(p.winner).toBe(P1)
    expect(p.scores[P1]).toBe(1)
  })
})

describe('buildMatchResultPayload', () => {
  it('含 gameType/胜者/得分/排行榜/历史', () => {
    const mode = createMode()
    const result = { matchWinner: P1, scores: { [P1]: 5, [P2]: 2 }, ranking: [{ rank: 1, playerId: P1, score: 5 }], history: [] }
    const p = mode.buildMatchResultPayload({ result })
    expect(p.gameType).toBe('arithmetic')
    expect(p.matchWinner).toBe(P1)
    expect(p.ranking).toHaveLength(1)
    expect(p.history).toEqual([])
  })
})

describe('getRobotDelayMs', () => {
  it('config 存在时返回 robotAnswerDelayMs', () => {
    const mode = createMode({ robotAnswerDelayMs: 15000 })
    expect(mode.getRobotDelayMs({ game: {} })).toBe(15000)
  })

  it('config 缺失时返回 20000', () => {
    const mode = createMode()
    expect(mode.getRobotDelayMs({ game: {} })).toBe(20000)
  })
})

describe('getRobotAnswer', () => {
  it('返回 question.correctAnswer', () => {
    const mode = createMode()
    expect(mode.getRobotAnswer({ correctAnswer: 42 })).toBe(42)
  })
})

describe('submitInput（完整流程）', () => {
  function makeCtx(mode) {
    const game = makeGame(mode, [P1, P2])
    const room = { id: 'r1', players: { [P1]: { nickname: '小明' }, [P2]: { nickname: '小红' } } }
    return { game, room, roomId: 'r1' }
  }

  it('正确答案返回 round_result', () => {
    const mode = createMode()
    const ctx = makeCtx(mode)
    const q = mode.createNextQuestion({ game: ctx.game })
    const result = mode.submitInput({ ...ctx, playerId: P1, input: { questionId: q.questionId, answer: q.correctAnswer } })
    expect(result.action).toBe('round_result')
    expect(result.result.winner).toBe(P1)
  })

  it('错误答案返回 waiting + ack', () => {
    const mode = createMode()
    const ctx = makeCtx(mode)
    const q = mode.createNextQuestion({ game: ctx.game })
    const result = mode.submitInput({ ...ctx, playerId: P1, input: { questionId: q.questionId, answer: 999 } })
    expect(result.action).toBe('waiting')
    expect(result.ack).toBeTruthy()
  })

  it('非本局玩家返回 error', () => {
    const mode = createMode()
    const ctx = makeCtx(mode)
    const q = mode.createNextQuestion({ game: ctx.game })
    const result = mode.submitInput({ ...ctx, playerId: 's3', input: { questionId: q.questionId, answer: 1 } })
    expect(result.action).toBe('error')
  })

  it('比赛结束后返回 error', () => {
    const mode = createMode()
    const ctx = makeCtx(mode)
    ctx.game.status = 'match_end'
    const result = mode.submitInput({ ...ctx, playerId: P1, input: { questionId: 'q1', answer: 1 } })
    expect(result.action).toBe('error')
  })

  it('先得 5 分触发 match_result', () => {
    const mode = createMode()
    const ctx = makeCtx(mode)
    for (let i = 0; i < 5; i++) {
      const q = mode.createNextQuestion({ game: ctx.game })
      const r = mode.submitInput({ ...ctx, playerId: P1, input: { questionId: q.questionId, answer: q.correctAnswer } })
      if (r.action === 'match_result') {
        expect(r.result.matchWinner).toBe(P1)
        expect(r.result.scores[P1]).toBe(5)
        return
      }
    }
    expect(true).toBe(false)
  })
})
