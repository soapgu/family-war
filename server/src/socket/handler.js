const roomManager = require('./roomManager')
const gameManager = require('./gameManager')
const { createRobotScheduler } = require('./robotScheduler')
const logger = require('../logger')
const ROBOT_ID = roomManager.ROBOT_ID

/**
 * 注册所有 Socket 事件
 * @param {import('socket.io').Server} io
 */
function registerHandlers(io) {
  // ==================== 统一的结果处理函数 ====================

  /** 广播轮结果到所有玩家（每人视角由 GameMode.buildPlayerRoundResultPayload 提供） */
  function broadcastRoundResult(roomId, result) {
    const game = gameManager.getGame(roomId)
    if (!game) return
    const room = roomManager.getRoom(roomId)
    const winnerNick = room?.players[result.winner]?.nickname || result.winner

    if (game.type === 'rps') {
      const outcome = result.winner === 'draw' ? '平局' : `${winnerNick} 胜出`
      logger.info(`[round] 第${result.round}局 — ${outcome}`)
    } else {
      logger.info(`[round] 第${result.round}题 — ${winnerNick} 答对`)
    }

    game.players.forEach((playerId) => {
      io.to(playerId).emit(
        'game:roundResult',
        gameManager.buildPlayerRoundResultPayload(roomId, playerId, result)
      )
    })
  }

  /** 广播赛果到所有玩家并更新房间状态 */
  function broadcastMatchResult(roomId, result) {
    const game = gameManager.getGame(roomId)
    if (!game) return
    const room = roomManager.getRoom(roomId)
    const winnerNick = room?.players[result.matchWinner]?.nickname || result.matchWinner

    logger.info(`[match] 比赛结束 — 胜者: ${winnerNick}`)

    game.players.forEach((playerId) => {
      io.to(playerId).emit(
        'game:matchResult',
        gameManager.buildMatchResultPayload(roomId, result)
      )
    })

    roomManager.broadcastRoomState(roomId, io)
  }

  /** 广播下一题并启动机器人定时器 */
  function broadcastQuestion(roomId, question) {
    const game = gameManager.getGame(roomId)
    if (!game) return

    game.players.forEach((playerId) => {
      io.to(playerId).emit(
        'game:question',
        gameManager.buildQuestionPayload(roomId, question)
      )
    })

    robotScheduler.schedule(roomId, question.questionId)
  }

  /** 统一处理游戏结果（轮结果 / 赛果） */
  function handleGameResult(roomId, outcome) {
    if (outcome.action === 'round_result') {
      broadcastRoundResult(roomId, outcome.result)

      const nextQuestion = gameManager.createNextQuestion(roomId)
      if (nextQuestion) {
        broadcastQuestion(roomId, nextQuestion)
      }
      return
    }

    if (outcome.action === 'match_result') {
      robotScheduler.clear(roomId)
      broadcastMatchResult(roomId, outcome.result)
    }
  }

  /** 清除房间游戏及其绑定的机器人定时器 */
  function clearGameAndRobotSchedule(roomId) {
    robotScheduler.clear(roomId)
    roomManager.clearGame(roomId)
  }

  // 创建 Robot Scheduler
  const robotScheduler = createRobotScheduler({
    gameManager,
    onRobotResult(rid, result) {
      handleGameResult(rid, result)
    },
  })

  io.on('connection', (socket) => {
    logger.info(`[connect] ${socket.id}`)

    /** @type {string|null} */
    let currentRoom = null

    function getNickname() {
      const room = currentRoom && roomManager.getRoom(currentRoom)
      return room?.players[socket.id]?.nickname || '?'
    }

    /** 统一处理玩家输入 */
    function handleGameInput(socket, input) {
      const rid = currentRoom
      if (!rid) {
        socket.emit('game:error', { message: '请先加入房间' })
        return
      }

      const game = gameManager.getGame(rid)
      if (!game) {
        socket.emit('game:error', { message: '没有进行中的比赛' })
        return
      }

      const outcome = gameManager.submitInput(rid, socket.id, input)

      if (outcome.action === 'error') {
        socket.emit('game:error', { message: outcome.message })
        return
      }

      if (outcome.action === 'waiting') {
        if (game.type === 'rps') {
          const hasRobot = game.players.includes(ROBOT_ID)
          logger.info(`[move] ${getNickname()} → ${input.choice} | ${hasRobot ? '机器人出拳' : '等待对手出拳'}`)

          if (hasRobot) {
            const robotResult = gameManager.handleRobotInput(rid)
            if (robotResult) handleGameResult(rid, robotResult)
          } else {
            socket.emit('game:waiting')
          }
          return
        }

        logger.info(`[answer] ${getNickname()} 答错 — ${outcome.ack?.correctAnswer}`)

        if (outcome.ack) {
          socket.emit('game:answerAck', {
            questionId: input.questionId,
            correct: false,
            ...outcome.ack,
          })
        } else {
          socket.emit('game:waiting')
        }

        const scheduleIntent = gameManager.getRobotScheduleAfterWaiting(rid)
        if (scheduleIntent?.action === 'accelerate') {
          robotScheduler.accelerate(
            rid,
            input.questionId,
            scheduleIntent.delayMs,
            { onlyIfRemainingGreaterThanMs: scheduleIntent.onlyIfRemainingGreaterThanMs }
          )
        }
        return
      }

      robotScheduler.clear(rid)
      handleGameResult(rid, outcome)
    }

    // ==================== 房间 ====================

    socket.on('room:join', ({ nickname, roomId = 'default' }) => {
      if (!nickname || !nickname.trim()) {
        socket.emit('game:error', { message: '昵称不能为空' })
        return
      }

      currentRoom = roomId
      const state = roomManager.joinRoom(socket, roomId, nickname.trim())

      logger.info(`[join] ${socket.id} (${nickname.trim()}) → ${roomId}`)

      socket.emit('room:state', state)
      socket.to(`room:${roomId}`).emit('player:joined', {
        id: socket.id,
        nickname: nickname.trim(),
      })
      roomManager.broadcastRoomState(roomId, io)
    })

    socket.on('room:leave', () => {
      if (!currentRoom) return
      const roomId = currentRoom

      logger.info(`[leave] ${socket.id} (${getNickname()}) ← ${roomId}`)

      cancelGameIfActive(roomId, socket.id)

      const state = roomManager.leaveRoom(socket, roomId)
      if (state) {
        socket.to(`room:${roomId}`).emit('player:left', { socketId: socket.id })
        roomManager.broadcastRoomState(roomId, io)
      } else {
        robotScheduler.clear(roomId)
      }
      currentRoom = null
    })

    // ==================== 角色 ====================

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

      logger.info(`[role] ${socket.id} (${getNickname()}) → ${role}`)
      roomManager.broadcastRoomState(rid, io)
    })

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

      logger.info(`[role] ${socket.id} (${getNickname()}) → 放弃`)
      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 游戏模式切换 ====================

    socket.on('game:setMode', ({ mode, difficulty } = {}) => {
      const rid = currentRoom
      if (!rid) {
        socket.emit('game:error', { message: '请先加入房间' })
        return
      }

      const result = roomManager.setGameMode(rid, mode, difficulty)
      if (result.error) {
        socket.emit('game:error', { message: result.error })
        return
      }

      logger.info(`[setMode] ${getNickname()} → ${mode}${difficulty ? ` (${difficulty})` : ''}`)
      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 统一挑战 ====================

    socket.on('game:challenge', ({ mode = 'rps', targetId, roomId } = {}) => {
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

      if (mode !== room.gameMode) {
        socket.emit('game:error', { message: '游戏模式已变更，请返回房间重试' })
        return
      }

      if (room.game && room.game.status === 'playing') {
        socket.emit('game:error', { message: '当前房间已有进行中的比赛' })
        return
      }
      if (room.game) clearGameAndRobotSchedule(rid)

      if (mode === 'rps') {
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

        const game = gameManager.createGame(rid, [socket.id, targetId], 'rps')

        logger.info(`[challenge] ${getNickname()} → ${target.nickname}`)

        ;[socket.id, targetId].forEach((id) => {
          io.to(id).emit('game:start', gameManager.buildStartPayload(rid, id))
        })
      } else {
        const playerIds = Object.values(room.roles).filter((id) => id !== null)

        if (playerIds.length < 1) {
          socket.emit('game:error', { message: '至少需要 1 名玩家选择角色' })
          return
        }

        const game = gameManager.createGame(rid, playerIds, mode, room.spellingDifficulty || 'easy')

        let firstQuestion
        try {
          firstQuestion = gameManager.createNextQuestion(rid)
        } catch (error) {
          clearGameAndRobotSchedule(rid)
          socket.emit('game:error', { message: error.message })
          return
        }

        logger.info(`[challenge] ${mode}模式 — ${playerIds.map((id) => room.players[id]?.nickname || id).join(', ')}`)

        playerIds.forEach((id) => {
          io.to(id).emit('game:start', gameManager.buildStartPayload(rid, id, firstQuestion))
        })

        robotScheduler.schedule(rid, firstQuestion.questionId)
      }

      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 出拳 / 答题 ====================

    socket.on('game:move', ({ choice, roomId } = {}) => {
      handleGameInput(socket, { choice })
    })

    socket.on('game:answer', ({ questionId, answer } = {}) => {
      handleGameInput(socket, { questionId, answer })
    })

    // ==================== 重赛 ====================

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
      if (!existingGame) {
        socket.emit('game:error', { message: '没有可重赛的已结束比赛' })
        return
      }
      if (existingGame.status !== 'match_end') {
        return
      }
      if (existingGame.type !== 'rps') {
        socket.emit('game:error', { message: '当前游戏不支持该重赛方式' })
        return
      }

      const p1 = existingGame.players[0]
      const p2 = existingGame.players[1]

      clearGameAndRobotSchedule(rid)
      const game = gameManager.createGame(rid, [p1, p2], 'rps')

      logger.info(`[rematch] ${getNickname()}`)

      ;[p1, p2].forEach((id) => {
        io.to(id).emit('game:start', gameManager.buildStartPayload(rid, id))
      })

      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 认输 ====================

    socket.on('game:forfeit', ({ roomId } = {}) => {
      const rid = roomId || currentRoom
      if (!rid) return

      const game = gameManager.getGame(rid)
      if (!game || game.status !== 'playing') return

      clearGameAndRobotSchedule(rid)

      logger.info(`[forfeit] ${getNickname()}`)

      const otherPlayer = game.players.find((id) => id !== socket.id)
      if (otherPlayer) {
        io.to(otherPlayer).emit('game:forfeited', {
          message: '对手认输了',
        })
      }

      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 断线 ====================

    socket.on('disconnect', () => {
      if (!currentRoom) {
        logger.info(`[disconnect] ${socket.id} (未加入房间)`)
        return
      }
      const roomId = currentRoom

      logger.info(`[disconnect] ${socket.id} (${getNickname()}) ← ${roomId}`)

      cancelGameIfActive(roomId, socket.id)

      const state = roomManager.handleDisconnect(socket)
      if (state) {
        socket.to(`room:${roomId}`).emit('player:left', { socketId: socket.id })
        roomManager.broadcastRoomState(roomId, io)
      } else {
        robotScheduler.clear(roomId)
      }
      currentRoom = null
    })

    function cancelGameIfActive(roomId, socketId) {
      const game = gameManager.getGame(roomId)
      if (!game || game.status !== 'playing') return
      if (!game.players.includes(socketId)) return

      if (game.type === 'arithmetic' || game.type === 'spelling') return

      const room = roomManager.getRoom(roomId)

      clearGameAndRobotSchedule(roomId)

      const otherPlayer = game.players.find((id) => id !== socketId)
      if (otherPlayer) {
        logger.info(`[cancel] ${room?.players[socketId]?.nickname || socketId} 离开，比赛取消`)
        io.to(otherPlayer).emit('game:cancelled', { message: '对手离开了房间' })
      }
    }
  })
}

module.exports = registerHandlers
