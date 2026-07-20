const QuizGameMode = require('./QuizGameMode')

/**
 * v3.1 Phase 1 重构 — 从 gameManager 拆分的算术游戏模式。
 *
 * 继承 QuizGameMode，实现加减法抢答（all-vs-all）。
 * - createNextQuestion：随机生成 +/- 题，结果 0-100
 * - normalizeAnswer：字符串转 Number
 * - validateAnswer：拒绝 NaN/Infinity
 * - getRobotDelayMs：默认 20000ms（config.robotAnswerDelayMs 可覆盖）
 * - buildStartPayload / buildQuestionPayload：含 expression 字段
 * - buildMatchResultPayload：含 ranking 排行榜
 * - 5 分制（config.winningScore 可配置）
 */

/** 生成算术题（+/-，结果 0-100） */
function generateArithmeticQuestion() {
  const op = Math.random() < 0.5 ? '+' : '-'
  let a, b, correctAnswer

  if (op === '+') {
    a = Math.floor(Math.random() * 101)
    b = Math.floor(Math.random() * (100 - a + 1))
    correctAnswer = a + b
  } else {
    a = Math.floor(Math.random() * 101)
    b = Math.floor(Math.random() * (a + 1))
    correctAnswer = a - b
  }

  return { expression: `${a} ${op} ${b}`, correctAnswer }
}

class ArithmeticGameMode extends QuizGameMode {
  constructor(deps) {
    super({ ...deps, type: 'arithmetic' })
  }

  normalizeAnswer(answer) {
    return Number(answer)
  }

  validateAnswer(normalizedAnswer) {
    if (!isFinite(normalizedAnswer)) {
      return { action: 'error', message: '答案必须是有效数字' }
    }
    return null
  }

  isCorrectAnswer(question, answer) {
    return answer === question.correctAnswer
  }

  buildWrongAnswerAck({ question, answer }) {
    return {
      correctAnswer: question.correctAnswer,
      expression: question.expression,
      yourAnswer: answer,
    }
  }

  getTimeLimitMs() {
    return this.config.questionTimeLimitMs || 20000
  }

  createNextQuestion({ game }) {
    const { expression, correctAnswer } = generateArithmeticQuestion()
    const question = {
      questionId: `q_${Date.now()}`,
      expression,
      correctAnswer,
      round: game.round,
      timeLimitMs: this.getTimeLimitMs(),
    }
    game.currentQuestion = question
    game.answeredThisRound = {}
    return question
  }

  buildStartPayload({ game, room, firstQuestion }) {
    return {
      gameType: this.type,
      players: this.buildPlayerList({ game, room }),
      round: game.round,
      timeLimitMs: this.getTimeLimitMs(),
      firstQuestion: this.buildQuestionPayload({ question: firstQuestion }),
    }
  }

  buildQuestionPayload({ question }) {
    return {
      questionId: question.questionId,
      expression: question.expression,
      round: question.round,
      timeLimitMs: question.timeLimitMs,
    }
  }

  getRobotDelayMs({ game }) {
    return this.config.robotAnswerDelayMs || 20000
  }

  getRobotAnswer(question) {
    return question.correctAnswer
  }

  createRoundSettlement({ game, playerId }) {
    const round = game.currentQuestion.round
    const questionId = game.currentQuestion.questionId
    const expression = game.currentQuestion.expression
    const correctAnswer = game.currentQuestion.correctAnswer

    return {
      historyItem: {
        round,
        questionId,
        expression,
        correctAnswer,
        winner: playerId,
        answeredBy: { ...game.answeredThisRound },
      },
      result: {
        round,
        questionId,
        expression,
        correctAnswer,
        winner: playerId,
      },
    }
  }

  buildPlayerRoundResultPayload({ result, playerId }) {
    return {
      gameType: this.type,
      round: result.round,
      questionId: result.questionId,
      expression: result.expression,
      correctAnswer: result.correctAnswer,
      yourAnswer: result.answeredBy?.[playerId],
      winner: result.winner,
      scores: result.scores,
    }
  }

  buildMatchResultPayload({ result }) {
    return {
      gameType: this.type,
      matchWinner: result.matchWinner,
      scores: result.scores,
      ranking: result.ranking,
      history: result.history,
    }
  }

  getDisplayName() {
    return '算术'
  }
}

module.exports = ArithmeticGameMode
