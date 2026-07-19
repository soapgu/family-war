const QuizGameMode = require('./QuizGameMode')

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

  createNextQuestion({ game }) {
    const { expression, correctAnswer } = generateArithmeticQuestion()
    const question = {
      questionId: `q_${Date.now()}`,
      expression,
      correctAnswer,
      round: game.round,
    }
    game.currentQuestion = question
    game.answeredThisRound = {}
    return question
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
