const roomManager = require('./roomManager')
const gameManager = require('./gameManager')
const { createRobotScheduler } = require('./robotScheduler')
const { Lifecycle } = require('./lifecycle')
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

  // 创建 Robot Scheduler
  const robotScheduler = createRobotScheduler({
    gameManager,
    onRobotResult(rid, result) {
      handleGameResult(rid, result)
    },
  })

  // v3.6 Phase 2 步骤 2c：统一对局清理入口（带 gameId 防护）
  const lifecycle = new Lifecycle({ io, roomManager, gameManager, robotScheduler, ROBOT_ID })

  io.on('connection', (socket) => {
    logger.info(`[connect] ${socket.id}`)

    /** @type {string|null} */
    let currentRoom = null

    function getNickname() {
      const room = currentRoom && roomManager.getRoom(currentRoom)
      return room?.players[socket.id]?.nickname || '?'
    }

    /**
     * v3.6 Phase 2 步骤 2i：统一拒绝操作日志。
     * 对所有 game:error 记录稳定字段（事件/roomId/gameId/类型/操作者/结果/原因）。
     */
    function emitError(socket, message, { rid, game } = {}) {
      const r = rid || currentRoom || '-'
      const gameId = game?.id || '-'
      const gameType = game?.type || '-'
      const op = getNickname() !== '?' ? getNickname() : socket.id
      logger.info(`[reject] room=${r} game=${gameId} type=${gameType} op=${op} result=rejected reason=${message}`)
      socket.emit('game:error', { message })
    }

    /** 统一处理玩家输入 */
    function handleGameInput(socket, input) {
      const rid = currentRoom
      if (!rid) {
        emitError(socket, '请先加入房间')
        return
      }

      const game = gameManager.getGame(rid)
      if (!game || game.status !== 'playing') {
        emitError(socket, '没有进行中的比赛')
        return
      }
      if (!game.players.includes(socket.id)) {
        emitError(socket, '你不是本局玩家')
        return
      }

      const outcome = gameManager.submitInput(rid, socket.id, input)

      if (outcome.action === 'error') {
        emitError(socket, outcome.message, { rid, game })
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

        // v3.6 Phase 2 步骤 2i：答题错只记题号，不记正确答案明文（脱敏规则 step.md:1500）
        logger.info(`[answer] room=${rid} game=${game.id} type=${game.type} op=${getNickname()} result=wrong question=${input.questionId}`)

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
        emitError(socket, '昵称不能为空')
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
      if (roomId && roomId !== currentRoom) {
        emitError(socket, '你不在这个房间中')
        return
      }
      const rid = currentRoom
      if (!rid) {
        emitError(socket, '请先加入房间')
        return
      }

      const result = roomManager.selectRole(socket, rid, role)
      if (result.error) {
        emitError(socket, result.error, { rid })
        return
      }

      logger.info(`[role] ${socket.id} (${getNickname()}) → ${role}`)
      roomManager.broadcastRoomState(rid, io)
    })

    socket.on('role:deselect', ({ roomId } = {}) => {
      if (roomId && roomId !== currentRoom) {
        emitError(socket, '你不在这个房间中')
        return
      }
      const rid = currentRoom
      if (!rid) {
        emitError(socket, '请先加入房间')
        return
      }

      const result = roomManager.deselectRole(socket, rid)
      if (result.error) {
        emitError(socket, result.error, { rid })
        return
      }

      logger.info(`[role] ${socket.id} (${getNickname()}) → 放弃`)
      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 游戏模式切换 ====================

    socket.on('game:setMode', ({ mode, difficulty } = {}) => {
      const rid = currentRoom
      if (!rid) {
        emitError(socket, '请先加入房间')
        return
      }

      const room = roomManager.getRoom(rid)
      if (!room || !room.players[socket.id]) {
        emitError(socket, '你不在这个房间中')
        return
      }

      const result = roomManager.setGameMode(rid, mode, difficulty)
      if (result.error) {
        emitError(socket, result.error, { rid })
        return
      }

      logger.info(`[setMode] ${getNickname()} → ${mode}${difficulty ? ` (${difficulty})` : ''}`)
      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 统一挑战 ====================

    socket.on('game:challenge', ({ mode = 'rps', targetId, roomId } = {}) => {
      if (roomId && roomId !== currentRoom) {
        emitError(socket, '你不在这个房间中')
        return
      }
      const rid = currentRoom
      if (!rid) {
        emitError(socket, '请先加入房间')
        return
      }

      const room = roomManager.getRoom(rid)
      if (!room) {
        emitError(socket, '房间不存在')
        return
      }

      // 通用调用者成员校验（rps/quiz 分支前统一拦截）
      if (!room.players[socket.id]) {
        emitError(socket, '你不在这个房间中')
        return
      }

      if (mode !== room.gameMode) {
        emitError(socket, '游戏模式已变更，请返回房间重试')
        return
      }

      if (room.game && room.game.status === 'playing') {
        emitError(socket, '当前房间已有进行中的比赛')
        return
      }

      // v3.6 Phase 2 步骤 2h：先完成全部授权校验，再清理旧终局
      if (mode === 'rps') {
        const challenger = room.players[socket.id]
        const target = room.players[targetId]
        if (!target) {
          emitError(socket, '玩家不存在')
          return
        }
        if (!challenger.role || !target.role) {
          emitError(socket, '双方都需选择角色后才能开始')
          return
        }
        if (challenger.role === target.role) {
          emitError(socket, '不能挑战自己')
          return
        }

        // 授权通过后清理旧终局
        if (room.game) lifecycle.cleanupGame(rid, room.game.id, { reason: 'replace_by_challenge' })

        const game = gameManager.createGame(rid, [socket.id, targetId], 'rps')

        logger.info(`[challenge] room=${rid} game=${game.id} type=rps op=${getNickname()} result=start reason=new_game`)

        ;[socket.id, targetId].forEach((id) => {
          io.to(id).emit('game:start', gameManager.buildStartPayload(rid, id))
        })
      } else {
        const playerIds = Object.values(room.roles).filter((id) => id !== null)

        if (playerIds.length < 1) {
          emitError(socket, '至少需要 1 名玩家选择角色')
          return
        }

        // 授权通过后清理旧终局
        if (room.game) lifecycle.cleanupGame(rid, room.game.id, { reason: 'replace_by_challenge' })

        const game = gameManager.createGame(rid, playerIds, mode, room.spellingDifficulty || 'easy')

        let firstQuestion
        try {
          firstQuestion = gameManager.createNextQuestion(rid)
        } catch (error) {
          lifecycle.cleanupGame(rid, game.id, { reason: 'first_question_failed' })
          emitError(socket, error.message, { rid, game })
          return
        }

        logger.info(`[challenge] room=${rid} game=${game.id} type=${mode} op=${getNickname()} result=start reason=new_game`)

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
      if (roomId && roomId !== currentRoom) {
        emitError(socket, '你不在这个房间中')
        return
      }
      const rid = currentRoom
      if (!rid) {
        emitError(socket, '请先加入房间')
        return
      }

      const room = roomManager.getRoom(rid)
      if (!room) {
        emitError(socket, '房间不存在')
        return
      }

      const player = room.players[socket.id]
      if (!player) {
        emitError(socket, '你不在这个房间中')
        return
      }

      const existingGame = room.game
      if (!existingGame) {
        emitError(socket, '没有可重赛的已结束比赛')
        return
      }
      if (existingGame.status !== 'match_end') {
        emitError(socket, '没有可重赛的已结束比赛')
        return
      }
      if (existingGame.type !== 'rps') {
        emitError(socket, '当前游戏不支持该重赛方式')
        return
      }

      // v3.6 Phase 2 步骤 2g：校验调用者是上一局参赛者
      if (!existingGame.players.includes(socket.id)) {
        emitError(socket, '你不是上一局玩家')
        return
      }

      // v3.6 Phase 2 步骤 2g：校验所有原真人参赛者仍在线
      const humanParticipants = existingGame.players.filter((id) => id !== ROBOT_ID)
      const allPresent = humanParticipants.every((id) => room.players[id])
      if (!allPresent) {
        emitError(socket, '原参赛者已离开，无法重赛')
        return
      }

      lifecycle.cleanupGame(rid, existingGame.id, { reason: 'replace_by_rematch' })
      const game = gameManager.createGame(rid, humanParticipants, 'rps')

      logger.info(`[rematch] room=${rid} game=${game.id} type=rps op=${getNickname()} result=start reason=replace_by_rematch`)

      humanParticipants.forEach((id) => {
        io.to(id).emit('game:start', gameManager.buildStartPayload(rid, id))
      })

      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 认输 ====================

    socket.on('game:forfeit', ({ roomId } = {}) => {
      if (roomId && roomId !== currentRoom) {
        emitError(socket, '你不在这个房间中')
        return
      }
      const rid = currentRoom
      if (!rid) {
        emitError(socket, '请先加入房间')
        return
      }

      const game = gameManager.getGame(rid)
      if (!game || game.status !== 'playing') {
        emitError(socket, '没有进行中的比赛')
        return
      }
      if (!game.players.includes(socket.id)) {
        emitError(socket, '你不是本局玩家')
        return
      }

      logger.info(`[forfeit] room=${rid} game=${game.id} type=${game.type} op=${getNickname()} result=forfeited reason=forfeit`)

      // v3.6 Phase 2 步骤 2e：统一走 cleanupGame 入口，校验参赛者后
      // 清理对局 + 清机器人调度 + 通知所有仍在线真人参赛者（排除认输者与机器人）。
      lifecycle.cleanupGame(rid, game.id, {
        reason: 'forfeit',
        notify: { event: 'game:forfeited', message: '对手认输了', excludeSocketId: socket.id },
      })

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
      if (!game) return
      if (!['playing', 'match_end'].includes(game.status)) return
      if (!game.players.includes(socketId)) return

      const room = roomManager.getRoom(roomId)
      const isFinal = game.status === 'match_end'
      
      logger.info(`[cancel] room=${roomId} game=${game.id} type=${game.type} op=${room?.players[socketId]?.nickname || socketId} result=cancelled reason=participant_left`)

      // v3.6 Phase 2 步骤 2d/2g：统一走 cleanupGame 入口
      // - 进行中离开：发 game:cancelled 通知其他参赛者
      // - 终局离开：不发通知（设计文档第 92 行）
      lifecycle.cleanupGame(roomId, game.id, {
        reason: 'participant_left',
        notify: isFinal ? null : { 
          event: 'game:cancelled', 
          message: '对手离开了房间', 
          excludeSocketId: socketId 
        },
      })
    }
  })
}

module.exports = registerHandlers
