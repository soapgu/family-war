const roomManager = require('./roomManager')
const createGameRegistry = require('./games/gameRegistry')
const unsplashClient = require('../unsplashClient')
const wordBank = require('../data/wordBank')
const config = require('../../config')

class GameManager {
  constructor() {
    /** @type {MatchRecord[]} */
    this.matchHistory = []

    this.registry = createGameRegistry({
      config,
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

  // ==================== 机器人调度 API ====================

  /**
   * 当前房间游戏是否需要启动机器人定时器。
   * 委托给对应 GameMode。
   * @param {string} roomId
   * @returns {boolean}
   */
  shouldScheduleRobot(roomId) {
    const room = roomManager.getRoom(roomId)
    const game = room?.game
    if (!room || !game) return false
    return this.registry.get(game.type).shouldScheduleRobot({ game, robotId: roomManager.ROBOT_ID })
  }

  /**
   * 获取机器人自动作答延迟毫秒数。
   * 委托给对应 GameMode。
   * @param {string} roomId
   * @returns {number}
   */
  getRobotDelayMs(roomId) {
    const room = roomManager.getRoom(roomId)
    const game = room?.game
    if (!room || !game) return 0
    return this.registry.get(game.type).getRobotDelayMs({ game })
  }

  /**
   * 机器人自动提交答案（统一入口，返回嵌套格式）。
   * 委托给对应 GameMode.handleRobotInput。
   * @param {string} roomId
   * @param {string} questionId
   * @returns {Object|null}
   */
  handleRobotInput(roomId, questionId) {
    const room = roomManager.getRoom(roomId)
    const game = room?.game
    if (!room || !game) return null
    const outcome = this.registry.get(game.type).handleRobotInput({
      roomId,
      room,
      game,
      robotId: roomManager.ROBOT_ID,
      questionId,
    })
    if (!outcome) return null
    if (outcome.action === 'match_result') {
      this.recordMatchHistory({ room, game, result: outcome.result })
    }
    return outcome
  }

  /**
   * 获取答错 waiting 后的机器人调度意图。
   * 委托给对应 GameMode（SpellingGameMode 会覆盖：所有人类答错后缩短到 5s）。
   * @param {string} roomId
   * @returns {{ action: 'accelerate', delayMs: number, onlyIfRemainingGreaterThanMs: number }|null}
   */
  getRobotScheduleAfterWaiting(roomId) {
    const room = roomManager.getRoom(roomId)
    const game = room?.game
    if (!room || !game) return null
    return this.registry.get(game.type).getRobotScheduleAfterWaiting({ game, allHumansAnswered: this.areAllHumansAnswered(roomId) })
  }

  // ==================== 统一 dispatch API（供 handler 1l 使用） ====================

  /**
   * 统一处理玩家输入。返回嵌套格式 { action, result }。
   * RPS input: { choice }
   * Quiz input: { questionId, answer }
   */
  submitInput(roomId, playerId, input) {
    const room = roomManager.getRoom(roomId)
    const game = room?.game
    if (!room || !game) {
      return { action: 'error', message: '游戏不存在' }
    }
    const outcome = this.registry.get(game.type).submitInput({
      roomId, room, game, playerId, input,
    })
    if (outcome?.action === 'match_result') {
      this.recordMatchHistory({ room, game, result: outcome.result })
    }
    return outcome
  }

  /**
   * 构建 game:start 事件 payload。
   * 委托给对应 GameMode.buildStartPayload。
   */
  buildStartPayload(roomId, playerId, firstQuestion) {
    const room = roomManager.getRoom(roomId)
    const game = room?.game
    if (!room || !game) return {}
    return this.registry.get(game.type).buildStartPayload({ game, room, playerId, firstQuestion })
  }

  /**
   * 构建 game:question payload。
   * 委托给对应 GameMode.buildQuestionPayload。
   */
  buildQuestionPayload(roomId, question) {
    const game = this.getGame(roomId)
    if (!game) return {}
    return this.registry.get(game.type).buildQuestionPayload({ question })
  }

  /**
   * 构建 game:roundResult 的单玩家视角 payload。
   * 委托给对应 GameMode.buildPlayerRoundResultPayload。
   */
  buildPlayerRoundResultPayload(roomId, playerId, result) {
    const game = this.getGame(roomId)
    if (!game) return {}
    return this.registry.get(game.type).buildPlayerRoundResultPayload({ game, result, playerId })
  }

  /**
   * 构建 game:matchResult payload。
   * 委托给对应 GameMode.buildMatchResultPayload。
   */
  buildMatchResultPayload(roomId, result) {
    const game = this.getGame(roomId)
    if (!game) return {}
    return this.registry.get(game.type).buildMatchResultPayload({ result })
  }

  /**
   * 为当前游戏生成下一道题并附加到 game 对象。
   * 委托给对应 GameMode.createNextQuestion。
   * 答题类模式返回 question object，RPS 返回 null。
   */
  createNextQuestion(roomId) {
    const game = this.getGame(roomId)
    if (!game) return null
    return this.registry.get(game.type).createNextQuestion({ game })
  }

  // ==================== 答题辅助 ====================

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
 */
