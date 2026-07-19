const QuizGameMode = require('./QuizGameMode')

/**
 * 英文默写游戏模式。
 *
 * 继承 QuizGameMode：
 * - 从启用词库取词
 * - 根据难度生成填空
 * - 附带图片 URL
 * - 玩家提交完整答案
 * - 机器人超时提交正确单词/短语
 */
class SpellingGameMode extends QuizGameMode {
  constructor({ wordBank, unsplashClient, ...deps }) {
    super({
      ...deps,
      type: 'spelling',
    })

    this.wordBank = wordBank
    this.unsplashClient = unsplashClient
  }

  getDisplayName() {
    return '默写'
  }

  createGame(params) {
    const game = super.createGame(params)
    game.difficulty = params.difficulty || 'easy'
    game.usedWords = []
    return game
  }

  createNextQuestion({ game }) {
    const word = this.pickWord(game)
    const blanks = this.generateBlanks(word, game.difficulty)

    const question = {
      questionId: `q_${Date.now()}`,
      word,
      wordLength: word.length,
      blanks,
      unsplashImageUrl: this.unsplashClient.getImageUrl(word),
      round: game.round,
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
      difficulty: game.difficulty,
      firstQuestion: this.buildQuestionPayload({ question: firstQuestion }),
    }
  }

  buildQuestionPayload({ question }) {
    return {
      questionId: question.questionId,
      ttsText: question.word,
      wordLength: question.wordLength,
      blanks: question.blanks,
      unsplashImageUrl: question.unsplashImageUrl,
      round: question.round,
    }
  }

  normalizeAnswer(answer) {
    return typeof answer === 'string' ? answer.trim() : answer
  }

  validateAnswer(answer) {
    if (typeof answer !== 'string' || !answer) {
      return { action: 'error', message: '答案必须是非空字符串' }
    }
    return null
  }

  isCorrectAnswer(question, answer) {
    return answer.toLowerCase() === question.word.toLowerCase()
  }

  buildWrongAnswerAck({ question, answer }) {
    return {
      correctAnswer: question.word,
      word: question.word,
      yourAnswer: answer,
    }
  }

  createRoundSettlement({ game, playerId }) {
    const q = game.currentQuestion

    return {
      historyItem: {
        round: q.round,
        questionId: q.questionId,
        word: q.word,
        blanks: q.blanks,
        correctAnswer: q.word,
        winner: playerId,
        answeredBy: { ...game.answeredThisRound },
      },
      result: {
        gameType: this.type,
        round: q.round,
        questionId: q.questionId,
        word: q.word,
        blanks: q.blanks,
        correctAnswer: q.word,
        winner: playerId,
      },
    }
  }

  buildPlayerRoundResultPayload({ result, playerId }) {
    return {
      gameType: this.type,
      round: result.round,
      questionId: result.questionId,
      word: result.word,
      blanks: result.blanks,
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

  getRobotAnswer(question) {
    return question.word
  }

  getTimeLimitMs({ game }) {
    const difficulty = game.difficulty || 'easy'
    return this.config.difficulties?.[difficulty]?.questionTimeLimitMs || 40000
  }

  getRobotDelayMs({ game }) {
    const difficulty = game.difficulty || 'easy'
    const conf = this.config.difficulties?.[difficulty]
    return conf?.robotAnswerDelayMs || this.getTimeLimitMs({ game })
  }

  getRobotScheduleAfterWaiting({ allHumansAnswered }) {
    if (!allHumansAnswered) return null

    return {
      action: 'accelerate',
      delayMs: 5000,
      onlyIfRemainingGreaterThanMs: 5000,
    }
  }

  pickWord(game) {
    const activeWords = this.wordBank.getActiveWords()
      .filter((word) => typeof word === 'string' && word.length > 0)

    if (activeWords.length === 0) {
      throw new Error('当前没有可用的默写单词，请先配置词库')
    }

    let available = activeWords.filter((word) => !game.usedWords.includes(word))
    if (available.length === 0) {
      game.usedWords = []
      available = activeWords
    }

    const word = available[Math.floor(Math.random() * available.length)]
    game.usedWords.push(word)

    return word
  }

  generateBlanks(word, difficulty) {
    const chars = word.split('')
    const letterIndices = chars
      .map((ch, index) => (ch !== ' ' ? index : -1))
      .filter((index) => index >= 0)

    let showCount
    if (difficulty === 'easy') {
      showCount = Math.ceil(letterIndices.length * 0.5)
    } else if (difficulty === 'normal') {
      showCount = Math.min(letterIndices.length, 1 + Math.floor(Math.random() * 2))
    } else {
      showCount = 0
    }

    const positions = [...letterIndices]
    for (let i = 0; i < showCount; i++) {
      const j = i + Math.floor(Math.random() * (positions.length - i))
      ;[positions[i], positions[j]] = [positions[j], positions[i]]
    }
    const shownSet = new Set(positions.slice(0, showCount))

    return chars.map((ch, index) => {
      if (ch === ' ') return '·'
      return shownSet.has(index) ? ch : '_'
    }).join(' ')
  }
}

module.exports = SpellingGameMode
