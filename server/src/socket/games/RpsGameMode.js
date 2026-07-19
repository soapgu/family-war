const BaseGameMode = require('./BaseGameMode')

const CHOICES = ['rock', 'paper', 'scissors']

/**
 * v3.1 Phase 1 重构 — 从 gameManager 拆分的猜拳游戏模式。
 *
 * 继承 BaseGameMode，实现 1v1 石头剪子布对战。
 * - submitInput：处理 player input { choice }，判胜负、结算 round/match
 * - handleRobotInput：机器人自动出拳（随机选择）
 * - 2 分制（config.winningScore 可配置），无 ranking
 * - buildPlayerRoundResultPayload 每人视角含 yourMove/oppMove
 * - buildMatchResultPayload 不含 ranking 字段
 * - match_result 不包含 ranking（vs QuizGameMode 的 all-vs-all ranking）
 *
 * 特点：
 * - 1v1 对战。
 * - 双方都出拳后结算一轮。
 * - 平局不加分，但会写入历史。
 * - 先到 2 分者胜。
 * - 机器人对手时，机器人即时随机出拳，不走定时器。
 */
class RpsGameMode extends BaseGameMode {
  constructor(deps) {
    super({
      ...deps,
      type: 'rps',
    })
  }

  /**
   * 创建 RPS 游戏，在基础状态上追加出拳记录字段。
   */
  createGame(params) {
    const game = this.createBaseGame(params)
    game.moves = {}
    return game
  }

  /**
   * RPS 的 game:start 是单人视角：
   * 每个玩家收到自己的 opponent。
   */
  buildStartPayload({ game, room, playerId }) {
    const opponentId = game.players.find((id) => id !== playerId)
    const opponent = room.players[opponentId]

    return {
      gameType: this.type,
      opponent: {
        id: opponentId,
        nickname: opponent?.nickname || opponentId,
        role: opponent?.role,
      },
      round: game.round,
    }
  }

  /**
   * 处理玩家出拳。
   */
  submitInput({ room, game, playerId, input }) {
    const choice = input.choice

    if (game.status === 'match_end') {
      return { action: 'error', message: '比赛已结束' }
    }

    if (!game.players.includes(playerId)) {
      return { action: 'error', message: '你不是本局玩家' }
    }

    if (!this.isValidChoice(choice)) {
      return { action: 'error', message: '无效的出拳' }
    }

    if (game.moves[playerId]) {
      return { action: 'error', message: '你已经出过拳了' }
    }

    game.moves[playerId] = choice

    const [p1, p2] = game.players

    if (!game.moves[p1] || !game.moves[p2]) {
      return {
        action: 'waiting',
        reason: 'waiting_opponent',
      }
    }

    return this.applyRoundResult({ room, game })
  }

  /**
   * 双方都出拳后的结算。
   */
  applyRoundResult({ game }) {
    const [p1, p2] = game.players
    const currentRound = game.round
    const result = this.getChoiceResult(game.moves[p1], game.moves[p2])

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

    const historyItem = {
      round: currentRound,
      moves: { ...game.moves },
      winner: roundWinner,
    }

    game.history.push(historyItem)
    game.moves = {}

    const p1Wins = game.scores[p1] || 0
    const p2Wins = game.scores[p2] || 0
    const winningScore = this.getWinningScore()

    if (p1Wins >= winningScore || p2Wins >= winningScore) {
      const matchWinner = p1Wins >= winningScore ? p1 : p2
      game.status = 'match_end'

      return {
        action: 'match_result',
        result: {
          gameType: this.type,
          matchWinner,
          scores: { ...game.scores },
          history: [...game.history],
        },
      }
    }

    game.round++

    return {
      action: 'round_result',
      result: {
        gameType: this.type,
        round: currentRound,
        winner: roundWinner,
        moves: historyItem.moves,
        scores: { ...game.scores },
      },
    }
  }

  /**
   * 机器人出拳。
   *
   * RPS 机器人是即时行为：
   * handler 在发现 waiting_opponent 且对手是机器人时调用。
   * 返回嵌套格式，外部通过 toLegacyResult 转换。
   */
  handleRobotInput({ roomId, room, game, robotId }) {
    return this.submitInput({
      roomId,
      room,
      game,
      playerId: robotId,
      input: {
        choice: this.randomChoice(),
      },
    })
  }

  /**
   * RPS 轮结果是每人视角。
   */
  buildPlayerRoundResultPayload({ game, result, playerId }) {
    const [a, b] = game.players
    const opponentId = playerId === a ? b : a

    return {
      round: result.round,
      winner: result.winner,
      yourMove: result.moves[playerId],
      oppMove: result.moves[opponentId],
      scores: result.scores,
    }
  }

  buildMatchResultPayload({ result }) {
    return {
      gameType: this.type,
      matchWinner: result.matchWinner,
      scores: result.scores,
      history: result.history,
    }
  }

  getWinningScore() {
    return this.config.winningScore || 2
  }

  isValidChoice(choice) {
    return CHOICES.includes(choice)
  }

  randomChoice() {
    return CHOICES[Math.floor(Math.random() * CHOICES.length)]
  }

  getChoiceResult(move1, move2) {
    if (move1 === move2) return 'draw'
    if (
      (move1 === 'rock' && move2 === 'scissors') ||
      (move1 === 'scissors' && move2 === 'paper') ||
      (move1 === 'paper' && move2 === 'rock')
    ) return 'player1'
    return 'player2'
  }
}

module.exports = RpsGameMode
