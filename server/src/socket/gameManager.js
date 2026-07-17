const roomManager = require('./roomManager')
const unsplashClient = require('../unsplashClient')
const wordBank = require('../data/wordBank')

const CHOICES = ['rock', 'paper', 'scissors']

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

/** 猜拳判定，返回 'player1' | 'player2' | 'draw' */
function getChoiceResult(move1, move2) {
  if (move1 === move2) return 'draw'
  if (
    (move1 === 'rock' && move2 === 'scissors') ||
    (move1 === 'scissors' && move2 === 'paper') ||
    (move1 === 'paper' && move2 === 'rock')
  ) return 'player1'
  return 'player2'
}

class GameManager {
  constructor() {
    /** @type {MatchRecord[]} */
    this.matchHistory = []
  }

  /**
   * 创建新游戏（统一入口）
   * @param {string} roomId
   * @param {string[]} playerIds
   * @param {'rps'|'arithmetic'|'spelling'} [type='rps']
   * @param {string} [difficulty]
   * @returns {Game|ArithmeticGame|SpellingGame}
   */
  createGame(roomId, playerIds, type = 'rps', difficulty) {
    /** @type {Game|ArithmeticGame|SpellingGame} */
    const game = {
      id: `game_${Date.now()}_${roomId}`,
      roomId,
      type,
      players: [...playerIds],
      round: 1,
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      history: [],
      status: 'playing',
    }

    if (type === 'arithmetic' || type === 'spelling') {
      game.currentQuestion = null
      game.answeredThisRound = {}
      if (type === 'spelling') {
        game.difficulty = difficulty || 'easy'
        game.usedWords = []
      }
    } else {
      game.moves = {}
    }

    roomManager.setGame(roomId, game)
    return game
  }

  /**
   * 玩家出拳
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} choice - 'rock' | 'paper' | 'scissors'
   * @returns {SubmitMoveResult}
   */
  submitMove(roomId, socketId, choice) {
    const room = roomManager.getRoom(roomId)
    if (!room || !room.game) {
      return { action: 'error', message: '游戏不存在' }
    }

    const game = room.game

    if (game.status === 'match_end') {
      return { action: 'error', message: '比赛已结束' }
    }

    if (!game.players.includes(socketId)) {
      return { action: 'error', message: '你不是本局玩家' }
    }

    if (!CHOICES.includes(choice)) {
      return { action: 'error', message: '无效的出拳' }
    }

    if (game.moves[socketId]) {
      return { action: 'error', message: '你已经出过拳了' }
    }

    game.moves[socketId] = choice

    const p1 = game.players[0]
    const p2 = game.players[1]

    // 对方还没出拳，等待
    if (!game.moves[p1] || !game.moves[p2]) {
      return { action: 'waiting' }
    }

    // 双方都已出拳，判定本局
    const currentRound = game.round
    const result = getChoiceResult(game.moves[p1], game.moves[p2])
    let roundWinner = null

    if (result === 'player1') {
      game.scores[p1]++
      roundWinner = p1
    } else if (result === 'player2') {
      game.scores[p2]++
      roundWinner = p2
    } else {
      roundWinner = 'draw'
    }

    game.history.push({
      round: currentRound,
      moves: { ...game.moves },
      winner: roundWinner,
    })

    game.moves = {}

    // 检查是否有人先到 2 胜
    if (game.scores[p1] >= 2 || game.scores[p2] >= 2) {
      const matchWinner = game.scores[p1] >= 2 ? p1 : p2
      game.status = 'match_end'

      this.matchHistory.push({
        id: game.id,
        roomId,
        players: [...game.players],
        playerNames: Object.fromEntries(game.players.map((id) => [id, room?.players[id]?.nickname || id])),
        scores: { ...game.scores },
        matchWinner,
        matchWinnerName: room?.players[matchWinner]?.nickname || matchWinner,
        history: [...game.history],
        endedAt: Date.now(),
      })

      return {
        action: 'match_result',
        matchWinner,
        scores: { ...game.scores },
        history: [...game.history],
      }
    }

    // 进入下一局
    game.round++

    return {
      action: 'round_result',
      round: currentRound,
      winner: roundWinner,
      moves: { ...game.history[game.history.length - 1].moves },
      scores: { ...game.scores },
    }
  }

  /**
   * 断线处理：取消进行中的比赛
   * @param {string} roomId
   * @param {string} socketId
   * @returns {{ action: 'cancelled' } | null}
   */
  handleDisconnect(roomId, socketId) {
    const room = roomManager.getRoom(roomId)
    if (!room || !room.game) return null

    const game = room.game
    if (game.status === 'match_end') return null

    if (!game.players.includes(socketId)) return null

    roomManager.clearGame(roomId)
    return { action: 'cancelled' }
  }

  /**
   * 获取房间当前游戏
   * @param {string} roomId
   * @returns {Game|null}
   */
  getGame(roomId) {
    const room = roomManager.getRoom(roomId)
    return room && room.game ? room.game : null
  }

  /**
   * 获取已结束的对局历史（管理后台使用）
   * @returns {MatchRecord[]}
   */
  getMatchHistory() {
    return this.matchHistory
  }

  // ==================== 算术引擎 ====================

  /**
   * 为指定游戏生成一道新题
   * @param {ArithmeticGame} game - 从 getGame 获取的游戏对象
   * @returns {{ questionId: string, expression: string, correctAnswer: number, round: number }}
   */
  generateQuestion(game) {
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

  /**
   * 提交算术题答案
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} questionId
   * @param {number} answer
   * @returns {ArithmeticAnswerResult}
   */
  submitArithmeticAnswer(roomId, socketId, questionId, answer) {
    const room = roomManager.getRoom(roomId)
    if (!room || !room.game || room.game.type !== 'arithmetic') {
      return { action: 'error', message: '算术游戏不存在' }
    }

    const game = room.game

    if (game.status !== 'playing') {
      return { action: 'error', message: '比赛已结束' }
    }

    if (!game.currentQuestion || game.currentQuestion.questionId !== questionId) {
      return { action: 'error', message: '题目已过期' }
    }

    if (!game.players.includes(socketId)) {
      return { action: 'error', message: '你不是本局玩家' }
    }

    if (game.answeredThisRound[socketId] !== undefined) {
      return { action: 'error', message: '你已经回答过本题' }
    }

    game.answeredThisRound[socketId] = answer

    if (answer !== game.currentQuestion.correctAnswer) {
      return {
        action: 'waiting',
        correctAnswer: game.currentQuestion.correctAnswer,
        expression: game.currentQuestion.expression,
        yourAnswer: answer,
      }
    }

    // 答对了
    game.scores[socketId]++
    const round = game.currentQuestion.round
    const expression = game.currentQuestion.expression
    const correctAnswer = game.currentQuestion.correctAnswer

    game.history.push({
      round,
      questionId,
      expression,
      correctAnswer,
      winner: socketId,
      answeredBy: { ...game.answeredThisRound },
    })

    game.currentQuestion = null
    game.round++

    // 检查是否有人先得 5 分
    if (game.scores[socketId] >= 5) {
      game.status = 'match_end'

      const ranking = [...game.players]
        .map((id) => ({
          playerId: id,
          nickname: room.players[id]?.nickname || id,
          score: game.scores[id] || 0,
        }))
        .sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId))
        .map((entry, idx) => ({ rank: idx + 1, ...entry }))

      this.matchHistory.push({
        id: game.id,
        roomId,
        type: 'arithmetic',
        players: [...game.players],
        playerNames: Object.fromEntries(
          game.players.map((id) => [id, room?.players[id]?.nickname || id])
        ),
        scores: { ...game.scores },
        matchWinner: socketId,
        matchWinnerName: room?.players[socketId]?.nickname || socketId,
        ranking,
        history: [...game.history],
        endedAt: Date.now(),
      })

      return {
        action: 'match_result',
        matchWinner: socketId,
        scores: { ...game.scores },
        ranking,
        history: [...game.history],
        answeredBy: { ...game.answeredThisRound },
      }
    }

    return {
      action: 'round_result',
      round,
      questionId,
      expression,
      correctAnswer,
      winner: socketId,
      scores: { ...game.scores },
      answeredBy: { ...game.answeredThisRound },
    }
  }

  /**
   * 机器人自动提交正确答案（超时后由 handler 调用）
   * @param {string} roomId
   * @param {string} questionId
   * @returns {ArithmeticAnswerResult|null}
   */
  handleRobotArithmeticAnswer(roomId, questionId) {
    const game = this.getGame(roomId)
    if (!game || game.type !== 'arithmetic') return null
    if (!game.currentQuestion || game.currentQuestion.questionId !== questionId) return null
    return this.submitArithmeticAnswer(roomId, roomManager.ROBOT_ID, questionId, game.currentQuestion.correctAnswer)
  }

  // ==================== 默写引擎 ====================

  /**
   * 根据单词和难度生成填空字符串
   * easy: 暴露 ceil(50%) 个字母
   * normal: 暴露 1-2 个字母
   * hard: 全部隐藏
   * @param {string} word
   * @param {'easy'|'normal'|'hard'} difficulty
   * @returns {string} 空格分隔的填空串，如 "a _ _ l _"
   */
  generateBlanks(word, difficulty) {
    const chars = word.split('')
    const letterIndices = chars.map((ch, i) => (ch !== ' ' ? i : -1)).filter((i) => i >= 0)

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

    return chars.map((ch, i) => {
      if (ch === ' ') return '·'
      return shownSet.has(i) ? ch : '_'
    }).join(' ')
  }

  /**
   * 为指定默写游戏生成一道新题
   * @param {SpellingGame} game
   * @returns {SpellingQuestion}
   */
  generateSpellingQuestion(game) {
    const activeWords = wordBank.getActiveWords()
      .filter((word) => typeof word === 'string' && word.length > 0)
    if (activeWords.length === 0) {
      throw new Error('当前没有可用的默写单词，请先配置词库')
    }

    let available = activeWords.filter((w) => !game.usedWords.includes(w))
    if (available.length === 0) {
      game.usedWords = []
      available = activeWords
    }
    const word = available[Math.floor(Math.random() * available.length)]
    game.usedWords.push(word)
    const blanks = this.generateBlanks(word, game.difficulty)
    const question = {
      questionId: `q_${Date.now()}`,
      word,
      wordLength: word.length,
      blanks,
      unsplashImageUrl: unsplashClient.getImageUrl(word),
      round: game.round,
    }
    game.currentQuestion = question
    game.answeredThisRound = {}
    return question
  }

  /**
   * 提交默写答案
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} questionId
   * @param {string} answer
   * @returns {SpellingAnswerResult}
   */
  submitSpellingAnswer(roomId, socketId, questionId, answer) {
    const room = roomManager.getRoom(roomId)
    if (!room || !room.game || room.game.type !== 'spelling') {
      return { action: 'error', message: '默写游戏不存在' }
    }

    const game = room.game

    if (game.status !== 'playing') {
      return { action: 'error', message: '比赛已结束' }
    }

    if (typeof questionId !== 'string' || questionId.length === 0) {
      return { action: 'error', message: '题目编号无效' }
    }

    if (!game.currentQuestion || game.currentQuestion.questionId !== questionId) {
      return { action: 'error', message: '题目已过期' }
    }

    if (!game.players.includes(socketId)) {
      return { action: 'error', message: '你不是本局玩家' }
    }

    if (game.answeredThisRound[socketId] !== undefined) {
      return { action: 'error', message: '你已经回答过本题' }
    }

    if (typeof answer !== 'string' || answer.trim().length === 0) {
      return { action: 'error', message: '答案必须是非空字符串' }
    }

    const normalizedAnswer = answer.trim()
    game.answeredThisRound[socketId] = normalizedAnswer

    if (normalizedAnswer.toLowerCase() !== game.currentQuestion.word.toLowerCase()) {
      return {
        action: 'waiting',
        correctAnswer: game.currentQuestion.word,
        word: game.currentQuestion.word,
        yourAnswer: normalizedAnswer,
      }
    }

    game.scores[socketId]++
    const round = game.currentQuestion.round
    const word = game.currentQuestion.word
    const blanks = game.currentQuestion.blanks

    game.history.push({
      round,
      questionId,
      word,
      blanks,
      correctAnswer: word,
      winner: socketId,
      answeredBy: { ...game.answeredThisRound },
    })

    game.currentQuestion = null
    game.round++

    if (game.scores[socketId] >= 5) {
      game.status = 'match_end'

      const ranking = [...game.players]
        .map((id) => ({
          playerId: id,
          nickname: room.players[id]?.nickname || id,
          score: game.scores[id] || 0,
        }))
        .sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId))
        .map((entry, idx) => ({ rank: idx + 1, ...entry }))

      this.matchHistory.push({
        id: game.id,
        roomId,
        type: 'spelling',
        players: [...game.players],
        playerNames: Object.fromEntries(
          game.players.map((id) => [id, room?.players[id]?.nickname || id])
        ),
        scores: { ...game.scores },
        matchWinner: socketId,
        matchWinnerName: room?.players[socketId]?.nickname || socketId,
        ranking,
        history: [...game.history],
        endedAt: Date.now(),
      })

      return {
        action: 'match_result',
        matchWinner: socketId,
        scores: { ...game.scores },
        ranking,
        history: [...game.history],
        answeredBy: { ...game.answeredThisRound },
      }
    }

    return {
      action: 'round_result',
      round,
      questionId,
      word,
      blanks,
      correctAnswer: word,
      winner: socketId,
      scores: { ...game.scores },
      answeredBy: { ...game.answeredThisRound },
    }
  }

  /**
   * 机器人自动提交正确单词（超时后由 handler 调用，时长由难度决定）
   * @param {string} roomId
   * @param {string} questionId
   * @returns {SpellingAnswerResult|null}
   */
  handleRobotSpellingAnswer(roomId, questionId) {
    const game = this.getGame(roomId)
    if (!game || game.type !== 'spelling') return null
    if (!game.currentQuestion || game.currentQuestion.questionId !== questionId) return null
    return this.submitSpellingAnswer(roomId, roomManager.ROBOT_ID, questionId, game.currentQuestion.word)
  }
}

const gameManager = new GameManager()
module.exports = gameManager

/**
 * @typedef {Object} MatchRecord
 * @property {string} id
 * @property {string} roomId
 * @property {'arithmetic'} [type]
 * @property {string[]} players
 * @property {Object<string, number>} scores
 * @property {string} matchWinner
 * @property {Array} history
 * @property {number} endedAt
 *
 * @typedef {Object} Game
 * @property {string} id
 * @property {string} roomId
 * @property {string[]} players - [p1SocketId, p2SocketId]
 * @property {number} round - 当前局号
 * @property {Object<string, number>} scores - { socketId: wins }
 * @property {Object<string, string>} moves - 当前局出拳 { socketId: choice }
 * @property {Array<{round: number, moves: Object, winner: string|null}>} history
 * @property {'playing'|'match_end'} status
 *
 * @typedef {Object} ArithmeticGame
 * @property {string} id
 * @property {string} roomId
 * @property {'arithmetic'} type
 * @property {string[]} players
 * @property {number} round
 * @property {Object<string, number>} scores
 * @property {{ questionId: string, expression: string, correctAnswer: number, round: number }|null} currentQuestion
 * @property {Object<string, number>} answeredThisRound - { socketId: answer }
 * @property {Array<{round: number, questionId: string, expression: string, correctAnswer: number, winner: string, answeredBy: Object<string, number>}>} history
 * @property {'playing'|'match_end'} status
 *
 * @typedef {Object} SpellingGame
 * @property {string} id
 * @property {string} roomId
 * @property {'spelling'} type
 * @property {string[]} players
 * @property {number} round
 * @property {Object<string, number>} scores
 * @property {'easy'|'normal'|'hard'} difficulty
 * @property {{ questionId: string, word: string, wordLength: number, blanks: string, unsplashImageUrl: string, round: number }|null} currentQuestion
 * @property {Object<string, string>} answeredThisRound - { socketId: answer }
 * @property {Array} history
 * @property {'playing'|'match_end'} status
 *
 * @typedef {Object} SpellingQuestion
 * @property {string} questionId
 * @property {string} word
 * @property {number} wordLength
 * @property {string} blanks
 * @property {string} unsplashImageUrl
 * @property {number} round
 *
 * @typedef {Object} SpellingAnswerResult
 * @property {'waiting'|'round_result'|'match_result'|'error'} action
 * @property {string} [message]
 * @property {number} [round]
 * @property {string} [questionId]
 * @property {string} [word]
 * @property {string} [blanks]
 * @property {string} [correctAnswer]
 * @property {string} [winner]
 * @property {Object<string, number>} [scores]
 * @property {string} [matchWinner]
 * @property {Array<{rank: number, playerId: string, nickname: string, score: number}>} [ranking]
 * @property {Array} [history]
 * @property {Object<string, string>} [answeredBy]
 *
 * @typedef {Object} SubmitMoveResult
 * @property {'waiting'|'round_result'|'match_result'|'error'} action
 * @property {string} [matchWinner]
 * @property {number} [round]
 * @property {string|null} [winner]
 * @property {Object} [moves]
 * @property {Object<string, number>} [scores]
 * @property {Array} [history]
 * @property {string} [message]
 *
 * @typedef {Object} ArithmeticAnswerResult
 * @property {'waiting'|'round_result'|'match_result'|'error'} action
 * @property {string} [message]
 * @property {number} [round]
 * @property {string} [questionId]
 * @property {string} [expression]
 * @property {number} [correctAnswer]
 * @property {string} [winner]
 * @property {Object<string, number>} [scores]
 * @property {string} [matchWinner]
 * @property {Array<{rank: number, playerId: string, nickname: string, score: number}>} [ranking]
 * @property {Array} [history]
 * @property {Object<string, number>} [answeredBy]
 */
