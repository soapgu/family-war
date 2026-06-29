const roomManager = require('./roomManager')

const CHOICES = ['rock', 'paper', 'scissors']

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
   * 创建新游戏
   * @param {string} roomId
   * @param {string} player1Id
   * @param {string} player2Id
   * @returns {Game}
   */
  createGame(roomId, player1Id, player2Id) {
    const game = {
      id: `game_${Date.now()}_${roomId}`,
      roomId,
      players: [player1Id, player2Id],
      round: 1,
      scores: { [player1Id]: 0, [player2Id]: 0 },
      moves: {},
      history: [],
      status: 'playing',
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
}

const gameManager = new GameManager()
module.exports = gameManager

/**
 * @typedef {Object} MatchRecord
 * @property {string} id
 * @property {string} roomId
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
 * @typedef {Object} SubmitMoveResult
 * @property {'waiting'|'round_result'|'match_result'|'error'} action
 * @property {string} [matchWinner]
 * @property {number} [round]
 * @property {string|null} [winner]
 * @property {Object} [moves]
 * @property {Object<string, number>} [scores]
 * @property {Array} [history]
 * @property {string} [message]
 */
