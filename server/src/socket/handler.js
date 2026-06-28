const roomManager = require('./roomManager')
const gameManager = require('./gameManager')

/**
 * 注册所有 Socket 事件
 * @param {import('socket.io').Server} io
 */
function registerHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[connect] ${socket.id}`)

    /** @type {string|null} */
    let currentRoom = null

    // ==================== 房间 ====================

    /** 玩家加入房间 → 创建/加入 socket.io room → 广播房间状态 */
    socket.on('room:join', ({ nickname, roomId = 'default' }) => {
      if (!nickname || !nickname.trim()) {
        socket.emit('game:error', { message: '昵称不能为空' })
        return
      }

      currentRoom = roomId
      const state = roomManager.joinRoom(socket, roomId, nickname.trim())

      socket.emit('room:state', state)
      socket.to(`room:${roomId}`).emit('player:joined', {
        id: socket.id,
        nickname: nickname.trim(),
      })
    })

    /** 玩家离开房间 → 取消进行中的比赛 → 释放角色 → 广播状态 */
    socket.on('room:leave', () => {
      if (!currentRoom) return
      const roomId = currentRoom

      cancelGameIfActive(roomId, socket.id)

      const state = roomManager.leaveRoom(socket, roomId)
      if (state) {
        socket.to(`room:${roomId}`).emit('player:left', { socketId: socket.id })
        roomManager.broadcastRoomState(roomId, io)
      }
      currentRoom = null
    })

    // ==================== 角色 ====================

    /** 选择角色 → 广播最新房间状态 */
    socket.on('role:select', ({ role, roomId } = {}) => {
      const rid = roomId || currentRoom
      if (!rid) {
        socket.emit('game:error', { message: '请先加入房间' })
        return
      }

      const result = roomManager.selectRole(socket, rid, role)
      if (result.error) {
        socket.emit('game:error', { message: result.error })
        return
      }

      roomManager.broadcastRoomState(rid, io)
    })

    /** 放弃当前角色 → 广播最新房间状态 */
    socket.on('role:deselect', ({ roomId } = {}) => {
      const rid = roomId || currentRoom
      if (!rid) {
        socket.emit('game:error', { message: '请先加入房间' })
        return
      }

      const result = roomManager.deselectRole(socket, rid)
      if (result.error) {
        socket.emit('game:error', { message: result.error })
        return
      }

      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 游戏 ====================

    /**
     * 向双方广播本轮结果（带各自视角）
     */
    function emitRoundResult(game, result) {
      const [a, b] = game.players
      for (const id of [a, b]) {
        io.to(id).emit('game:roundResult', {
          round: result.round,
          winner: result.winner,
          yourMove: result.moves[id],
          oppMove: result.moves[id === a ? b : a],
          scores: result.scores,
        })
      }
    }

    /**
     * 向双方广播赛果，并更新房间状态
     */
    function emitMatchResult(game, result, roomId) {
      const data = {
        matchWinner: result.matchWinner,
        scores: result.scores,
        history: result.history,
      }
      game.players.forEach((id) => io.to(id).emit('game:matchResult', data))
      roomManager.broadcastRoomState(roomId, io)
    }

    /** 发起挑战 → 校验双方角色 → 创建游戏 → 通知双方并广播状态 */
    socket.on('game:challenge', ({ targetId, roomId } = {}) => {
      const rid = roomId || currentRoom
      if (!rid) {
        socket.emit('game:error', { message: '请先加入房间' })
        return
      }

      const room = roomManager.getRoom(rid)
      if (!room) {
        socket.emit('game:error', { message: '房间不存在' })
        return
      }

      if (room.game) {
        socket.emit('game:error', { message: '当前房间已有进行中的比赛' })
        return
      }

      const challenger = room.players[socket.id]
      const target = room.players[targetId]
      if (!challenger || !target) {
        socket.emit('game:error', { message: '玩家不存在' })
        return
      }

      if (!challenger.role || !target.role) {
        socket.emit('game:error', { message: '双方都需选择角色后才能开始' })
        return
      }

      if (challenger.role === target.role) {
        socket.emit('game:error', { message: '不能挑战自己' })
        return
      }

      const game = gameManager.createGame(rid, socket.id, targetId)

      io.to(socket.id).emit('game:start', {
        opponent: { id: targetId, nickname: target.nickname, role: target.role },
        round: game.round,
      })
      io.to(targetId).emit('game:start', {
        opponent: { id: socket.id, nickname: challenger.nickname, role: challenger.role },
        round: game.round,
      })

      roomManager.broadcastRoomState(rid, io)
    })

    /** 出拳 → 等待/本局结果/赛果分别广播给双方 */
    socket.on('game:move', ({ choice, roomId } = {}) => {
      const rid = roomId || currentRoom
      if (!rid) {
        socket.emit('game:error', { message: '请先加入房间' })
        return
      }

      const game = gameManager.getGame(rid)
      if (!game) {
        socket.emit('game:error', { message: '没有进行中的比赛' })
        return
      }

      const result = gameManager.submitMove(rid, socket.id, choice)

      if (result.action === 'error') {
        socket.emit('game:error', { message: result.message })
        return
      }

      if (result.action === 'waiting') {
        socket.emit('game:waiting')
        return
      }

      if (result.action === 'round_result') emitRoundResult(game, result)
      if (result.action === 'match_result') emitMatchResult(game, result, rid)
    })

    /** 请求重赛 → 用同一对玩家重新开局 */
    socket.on('game:rematch', ({ roomId } = {}) => {
      const rid = roomId || currentRoom
      if (!rid) {
        socket.emit('game:error', { message: '请先加入房间' })
        return
      }

      const room = roomManager.getRoom(rid)
      if (!room) {
        socket.emit('game:error', { message: '房间不存在' })
        return
      }

      const player = room.players[socket.id]
      if (!player) {
        socket.emit('game:error', { message: '你不在这个房间中' })
        return
      }

      const existingGame = room.game
      if (!existingGame || existingGame.status !== 'match_end') {
        socket.emit('game:error', { message: '没有可重赛的已结束比赛' })
        return
      }

      const p1 = existingGame.players[0]
      const p2 = existingGame.players[1]

      roomManager.clearGame(rid)
      const game = gameManager.createGame(rid, p1, p2)

      io.to(p1).emit('game:start', {
        opponent: { id: p2, nickname: room.players[p2]?.nickname, role: room.players[p2]?.role },
        round: game.round,
      })
      io.to(p2).emit('game:start', {
        opponent: { id: p1, nickname: room.players[p1]?.nickname, role: room.players[p1]?.role },
        round: game.round,
      })

      roomManager.broadcastRoomState(rid, io)
    })

    /** 认输 → 通知对手 → 清理游戏状态 */
    socket.on('game:forfeit', ({ roomId } = {}) => {
      const rid = roomId || currentRoom
      if (!rid) return

      const game = gameManager.getGame(rid)
      if (!game || game.status !== 'playing') return

      roomManager.clearGame(rid)

      const otherPlayer = game.players.find((id) => id !== socket.id)
      if (otherPlayer) {
        io.to(otherPlayer).emit('game:forfeited', {
          message: '对手认输了',
        })
      }

      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 断线 ====================

    /** 断线 → 取消比赛 → 清理玩家 → 通知房间 */
    socket.on('disconnect', () => {
      console.log(`[disconnect] ${socket.id}`)
      if (!currentRoom) return
      const roomId = currentRoom

      cancelGameIfActive(roomId, socket.id)

      const state = roomManager.handleDisconnect(socket)
      if (state) {
        socket.to(`room:${roomId}`).emit('player:left', { socketId: socket.id })
        roomManager.broadcastRoomState(roomId, io)
      }
      currentRoom = null
    })

    /**
     * 如果玩家有进行中的比赛，取消并通知对手
     * @param {string} roomId
     * @param {string} socketId
     */
    function cancelGameIfActive(roomId, socketId) {
      const game = gameManager.getGame(roomId)
      if (!game || game.status !== 'playing') return
      if (!game.players.includes(socketId)) return

      gameManager.handleDisconnect(roomId, socketId)

      const otherPlayer = game.players.find((id) => id !== socketId)
      if (otherPlayer) {
        io.to(otherPlayer).emit('game:cancelled', { message: '对手离开了房间' })
      }
    }
  })
}

module.exports = registerHandlers
