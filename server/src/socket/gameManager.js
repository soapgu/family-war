const roomManager = require('./roomManager')
const createGameRegistry = require('./games/gameRegistry')
const unsplashClient = require('../unsplashClient')
const wordBank = require('../data/wordBank')

class GameManager {
  constructor() {
    /** @type {MatchRecord[]} */
    this.matchHistory = []

    this.registry = createGameRegistry({
      config: {},
      roomManager,
      wordBank,
      unsplashClient,
    })
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
    const mode = this.registry.get(type)
    const game = mode.createGame({ roomId, playerIds, difficulty })
    roomManager.setGame(roomId, game)
    return game
  }

  /**
   * 玩家出拳（兼容壳）
   *
   * 内部委托给 RpsGameMode.submitInput。
   * GameMode 内部统一使用嵌套格式 { action, result }，
   * 兼容壳通过 toLegacyResult 转换为旧调用方期望的平铺格式。
   *
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} choice - 'rock' | 'paper' | 'scissors'
   * @returns {SubmitMoveResult}
   */
  submitMove(roomId, socketId, choice) {
    const room = roomManager.getRoom(roomId)
    const game = room?.game
    if (!room || !game) {
      return { action: 'error', message: '游戏不存在' }
    }

    const outcome = this.registry.get('rps').submitInput({
      room,
      game,
      playerId: socketId,
      input: { choice },
    })

    if (outcome.action === 'match_result') {
      this.recordMatchHistory({ room, game, result: outcome.result })
    }

    return this.toLegacyResult(outcome)
  }

  /**
   * 将新 GameMode 的嵌套返回结构转换为旧 public API 的平铺结构。
   *
   * 新结构：{ action: 'round_result', result: { winner, scores } }
   * 旧结构：{ action: 'round_result', winner, scores }
   *
   * 旧单元测试、旧 handler 在迁移完成前都依赖平铺字段。
   */
  toLegacyResult(outcome) {
    if (!outcome) return outcome

    if (outcome.result) {
      return {
        action: outcome.action,
        ...outcome.result,
      }
    }

    if (outcome.ack) {
      return {
        action: outcome.action,
        ...outcome.ack,
      }
    }

    return outcome
  }

  /**
   * 记录比赛历史。
   *
   * 可以保留当前 history 字段结构，避免管理后台破坏。
   * RPS 没有 ranking，因此 ranking 只能在 result.ranking 存在时写入。
   */
  recordMatchHistory({ room, game, result }) {
    const record = {
      id: game.id,
      roomId: game.roomId,
      type: game.type,
      players: [...game.players],
      playerNames: Object.fromEntries(
        game.players.map((id) => [id, room?.players[id]?.nickname || id])
      ),
      scores: { ...result.scores },
      matchWinner: result.matchWinner,
      matchWinnerName: room?.players[result.matchWinner]?.nickname || result.matchWinner,
      history: [...result.history],
      endedAt: Date.now(),
    }

    if (result.ranking) {
      record.ranking = result.ranking
    }

    this.matchHistory.push(record)
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
   * 为指定算术游戏生成一道新题（兼容壳）
   *
   * 委托给 registry 中的 ArithmeticGameMode。
   *
   * @param {ArithmeticGame} game
   * @returns {{ questionId: string, expression: string, correctAnswer: number, round: number }}
   */
  generateQuestion(game) {
    return this.registry.get('arithmetic').createNextQuestion({ game })
  }

  /**
   * 提交算术题答案（兼容壳）
   *
   * 委托给 registry 中的 ArithmeticGameMode。
   *
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} questionId
   * @param {number} answer
   * @returns {ArithmeticAnswerResult}
   */
  submitArithmeticAnswer(roomId, socketId, questionId, answer) {
    const room = roomManager.getRoom(roomId)
    const game = room?.game
    if (!room || !game || game.type !== 'arithmetic') {
      return { action: 'error', message: '算术游戏不存在' }
    }

    const outcome = this.registry.get('arithmetic').submitInput({
      roomId,
      room,
      game,
      playerId: socketId,
      input: { questionId, answer },
    })

    if (outcome.action === 'match_result') {
      this.recordMatchHistory({ room, game, result: outcome.result })
    }

    return this.toLegacyResult(outcome)
  }

  /**
   * 机器人自动提交正确答案（兼容壳）
   *
   * 委托给 registry 中的 ArithmeticGameMode。
   *
   * @param {string} roomId
   * @param {string} questionId
   * @returns {ArithmeticAnswerResult|null}
   */
  handleRobotArithmeticAnswer(roomId, questionId) {
    const outcome = this.registry.get('arithmetic').handleRobotInput({
      roomId,
      room: roomManager.getRoom(roomId),
      game: this.getGame(roomId),
      robotId: roomManager.ROBOT_ID,
      questionId,
    })

    if (!outcome) return null

    if (outcome.action === 'match_result') {
      this.recordMatchHistory({
        room: roomManager.getRoom(roomId),
        game: this.getGame(roomId),
        result: outcome.result,
      })
    }

    return this.toLegacyResult(outcome)
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
   * 为指定默写游戏生成一道新题（兼容壳）
   *
   * 委托给 registry 中的 SpellingGameMode。
   *
   * @param {SpellingGame} game
   * @returns {SpellingQuestion}
   */
  generateSpellingQuestion(game) {
    return this.registry.get('spelling').createNextQuestion({ game })
  }

  /**
   * 提交默写答案（兼容壳）
   *
   * 先校验 questionId 类型长度（spelling 特有，不在 QuizGameMode 中），
   * 再委托给 registry 中的 SpellingGameMode。
   *
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

    if (typeof questionId !== 'string' || questionId.length === 0) {
      return { action: 'error', message: '题目编号无效' }
    }

    if (typeof answer !== 'string' || answer.trim().length === 0) {
      return { action: 'error', message: '答案必须是非空字符串' }
    }

    const outcome = this.registry.get('spelling').submitInput({
      roomId,
      room,
      game,
      playerId: socketId,
      input: { questionId, answer },
    })

    if (outcome.action === 'match_result') {
      this.recordMatchHistory({ room, game, result: outcome.result })
    }

    return this.toLegacyResult(outcome)
  }

  /**
   * 机器人自动提交正确单词（兼容壳）
   *
   * 委托给 registry 中的 SpellingGameMode。
   *
   * @param {string} roomId
   * @param {string} questionId
   * @returns {SpellingAnswerResult|null}
   */
  handleRobotSpellingAnswer(roomId, questionId) {
    const outcome = this.registry.get('spelling').handleRobotInput({
      roomId,
      room: roomManager.getRoom(roomId),
      game: this.getGame(roomId),
      robotId: roomManager.ROBOT_ID,
      questionId,
    })

    if (!outcome) return null

    if (outcome.action === 'match_result') {
      this.recordMatchHistory({
        room: roomManager.getRoom(roomId),
        game: this.getGame(roomId),
        result: outcome.result,
      })
    }

    return this.toLegacyResult(outcome)
  }

  /**
   * 检查游戏中的所有人类玩家是否都已作答
   * @param {string} roomId
   * @returns {boolean}
   */
  areAllHumansAnswered(roomId) {
    const game = this.getGame(roomId)
    if (!game || !game.answeredThisRound) return false
    const humanIds = game.players.filter((id) => id !== roomManager.ROBOT_ID)
    return humanIds.length > 0 && humanIds.every((id) => game.answeredThisRound[id] !== undefined)
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
