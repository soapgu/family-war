/**
 * 所有游戏模式的基类。
 *
 * 职责：
 * 1. 提供通用 game state 创建逻辑（id、players、scores、history 等）。
 * 2. 提供 ranking / player list 等通用辅助方法。
 * 3. 定义子类需要实现的方法形状（通过默认抛错模拟 abstract method）。
 *
 * 子类继承树：
 *   BaseGameMode
 *   ├── RpsGameMode        — 石头剪子布（1v1）
 *   └── QuizGameMode       — 出题抢答类
 *       ├── ArithmeticGameMode  — 算术达人
 *       └── SpellingGameMode    — 英文默写
 */
class BaseGameMode {
  /**
   * @param {Object} deps
   * @param {string} deps.type - 游戏类型标识（rps / arithmetic / spelling）
   * @param {Object} [deps.config] - 该模式的配置项，Phase 2 后从 config.js 注入
   * @param {Object} deps.roomManager - 房间管理器，用于获取 ROBOT_ID 和玩家信息
   */
  constructor({ type, config = {}, roomManager }) {
    if (!type) throw new Error('Game mode type is required')
    this.type = type
    this.config = config
    this.roomManager = roomManager
  }

  /**
   * 创建所有游戏共享的基础状态。
   *
   * 子类通常先调用 createBaseGame，再追加自己的私有字段：
   * - RPS 追加 game.moves
   * - Quiz 类游戏追加 game.currentQuestion / game.answeredThisRound
   * - Spelling 追加 game.difficulty / game.usedWords
   *
   * @param {{ roomId: string, playerIds: string[] }} params
   * @returns {Object} baseGame
   */
  createBaseGame({ roomId, playerIds }) {
    return {
      id: `game_${Date.now()}_${roomId}`,
      roomId,
      type: this.type,
      players: [...playerIds],
      round: 1,
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      history: [],
      status: 'playing',
    }
  }

  // ==================== 抽象方法（子类必须实现） ====================

  /** 创建具体游戏，返回 game 对象 */
  createGame() {
    throw new Error(`${this.type}.createGame() not implemented`)
  }

  /** 构建 game:start 事件 payload，RPS 和答题类结构差异较大 */
  buildStartPayload() {
    throw new Error(`${this.type}.buildStartPayload() not implemented`)
  }

  /**
   * 处理玩家输入。
   * RPS input: { choice }          — 出拳
   * Quiz input: { questionId, answer }  — 答题
   */
  submitInput() {
    throw new Error(`${this.type}.submitInput() not implemented`)
  }

  /** 构建发送给单个玩家的 game:roundResult payload */
  buildPlayerRoundResultPayload() {
    throw new Error(`${this.type}.buildPlayerRoundResultPayload() not implemented`)
  }

  /** 构建 game:matchResult payload */
  buildMatchResultPayload() {
    throw new Error(`${this.type}.buildMatchResultPayload() not implemented`)
  }

  // ==================== 可选覆盖方法 ====================

  /** 创建下一题。RPS 没有题目，默认返回 null。 */
  createNextQuestion() {
    return null
  }

  /** 构建 game:question payload。RPS 没有题目，默认返回 null。 */
  buildQuestionPayload() {
    return null
  }

  /** 处理机器人输入。默认返回 null，表示无需机器人定时处理。 */
  handleRobotInput() {
    return null
  }

  /** 当前模式是否需要启动机器人定时器。RPS 不出拳不走定时器。 */
  shouldScheduleRobot() {
    return false
  }

  /** 获取题目时间限制毫秒数。RPS 无时间限制，默认 0。 */
  getTimeLimitMs() {
    return 0
  }

  /** 获取机器人自动作答延迟毫秒数。RPS 默认 0。 */
  getRobotDelayMs() {
    return 0
  }

  /**
   * 获取胜利分数。
   * RPS 子类覆盖为 2；算术/默写默认 5。
   */
  getWinningScore() {
    return this.config.winningScore || 5
  }

  /**
   * 答错 waiting 后的机器人调度意图。
   * SpellingGameMode 会覆盖它：所有人类都答错后缩短倒计时到 5s。
   */
  getRobotScheduleAfterWaiting() {
    return null
  }

  // ==================== 通用辅助方法 ====================

  /**
   * 判断指定玩家是否已经赢得整场比赛。
   * @param {Object} game
   * @param {string} playerId
   * @returns {boolean}
   */
  isMatchEnded(game, playerId) {
    return (game.scores[playerId] || 0) >= this.getWinningScore()
  }

  /**
   * 构建排行榜（按分数降序，同分按 playerId 字典序）。
   * 算术和默写结算页复用该结构。
   *
   * @param {{ game: Object, room: Object }} params
   * @returns {Array<{ rank: number, playerId: string, nickname: string, score: number }>}
   */
  buildRanking({ game, room }) {
    return [...game.players]
      .map((id) => ({
        playerId: id,
        nickname: room.players[id]?.nickname || id,
        score: game.scores[id] || 0,
      }))
      .sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId))
      .map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }))
  }

  /**
   * 构建参与玩家列表（含昵称和角色）。
   * 算术和默写的 game:start 需要该列表。
   *
   * @param {{ game: Object, room: Object }} params
   * @returns {Array<{ id: string, nickname: string, role: string|null }>}
   */
  buildPlayerList({ game, room }) {
    return game.players.map((id) => ({
      id,
      nickname: room.players[id]?.nickname || id,
      role: room.players[id]?.role || null,
    }))
  }
}

module.exports = BaseGameMode
