const roomManager = require('./roomManager')
const gameManager = require('./gameManager')
const ROBOT_ID = roomManager.ROBOT_ID

const CHOICES = ['rock', 'paper', 'scissors']

const ARITHMETIC_TIMEOUT = 20000
const SPELLING_TIMEOUT_MAP = { easy: 40000, normal: 30000, hard: 20000 }

function randomChoice() {
  return CHOICES[Math.floor(Math.random() * CHOICES.length)]
}

/**
 * 注册所有 Socket 事件
 * @param {import('socket.io').Server} io
 */
function registerHandlers(io) {
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const robotTimers = new Map()

  io.on('connection', (socket) => {
    console.log(`[${ts()}] [connect] ${socket.id}`)

    /** @type {string|null} */
    let currentRoom = null

    /**
     * 获取当前 socket 的昵称
     */
    function getNickname() {
      const room = currentRoom && roomManager.getRoom(currentRoom)
      return room?.players[socket.id]?.nickname || '?'
    }

    /**
     * 当前时间戳
     */
    function ts() {
      return new Date().toLocaleTimeString()
    }

    // ==================== 房间 ====================

    /** 玩家加入房间 → 创建/加入 socket.io room → 广播房间状态 */
    socket.on('room:join', ({ nickname, roomId = 'default' }) => {
      if (!nickname || !nickname.trim()) {
        socket.emit('game:error', { message: '昵称不能为空' })
        return
      }

      currentRoom = roomId
      const state = roomManager.joinRoom(socket, roomId, nickname.trim())

      console.log(`[${ts()}] [join] ${socket.id} (${nickname.trim()}) → ${roomId}`)

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

      console.log(`[${ts()}] [leave] ${socket.id} (${getNickname()}) ← ${roomId}`)

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

      console.log(`[${ts()}] [role] ${socket.id} (${getNickname()}) → ${role}`)
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

      console.log(`[${ts()}] [role] ${socket.id} (${getNickname()}) → 放弃`)
      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 游戏模式切换 ====================

    /** 切换房间游戏模式 → 广播房间状态 */
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

      console.log(`[${ts()}] [setMode] ${getNickname()} → ${mode}${difficulty ? ` (${difficulty})` : ''}`)
      roomManager.broadcastRoomState(rid, io)
    })

    // ==================== 游戏 ====================

    /**
     * 向双方广播本轮结果（带各自视角）
     */
    function emitRoundResult(game, result) {
      const [a, b] = game.players
      const room = roomManager.getRoom(game.roomId)
      const nameA = room?.players[a]?.nickname || a
      const nameB = room?.players[b]?.nickname || b
      const moveA = result.moves[a]
      const moveB = result.moves[b]
      const winnerName = result.winner === 'draw' ? '平局' : room?.players[result.winner]?.nickname || result.winner

      console.log(`[${ts()}] [round] 第${result.round}局 — ${nameA}(${moveA}) vs ${nameB}(${moveB}) → ${winnerName} 胜`)

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
      const room = roomManager.getRoom(roomId)
      const winnerNick = room?.players[result.matchWinner]?.nickname || result.matchWinner
      const scoresStr = Object.entries(result.scores)
        .map(([id, s]) => `${room?.players[id]?.nickname || id} ${s}分`)
        .join(' ')

      console.log(`[${ts()}] [match] 比赛结束 → 胜者: ${winnerNick} (${scoresStr})`)
      console.log(`[${ts()}] [match] 历史: ${result.history.length}局`)

      const data = {
        gameType: 'rps',
        matchWinner: result.matchWinner,
        scores: result.scores,
        history: result.history,
      }
      game.players.forEach((id) => io.to(id).emit('game:matchResult', data))
      roomManager.broadcastRoomState(roomId, io)
    }

    /** 发起挑战 → 按 mode 分流 RPS / 算术 */
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
      if (room.game) roomManager.clearGame(rid)

      if (mode === 'arithmetic') {
        return handleArithmeticChallenge(rid, room, socket)
      }

      if (mode === 'spelling') {
        return handleSpellingChallenge(rid, room, socket)
      }

      return handleRpsChallenge(rid, room, socket, targetId)
    })

    /** 算术挑战：全员参战 → 发题 → 启动机器人定时器（20s） */
    function handleArithmeticChallenge(rid, room, socket) {
      const playerIds = Object.values(room.roles).filter((id) => id !== null)

      if (playerIds.length < 1) {
        socket.emit('game:error', { message: '至少需要 1 名玩家选择角色' })
        return
      }

      const game = gameManager.createGame(rid, playerIds, 'arithmetic')
      const firstQuestion = gameManager.generateQuestion(game)

      const playerList = playerIds.map((id) => ({
        id,
        nickname: room.players[id]?.nickname || id,
        role: room.players[id]?.role || null,
      }))

      console.log(`[${ts()}] [challenge] 算术模式 — ${playerList.map((p) => p.nickname).join(', ')}`)

      playerIds.forEach((id) => {
        io.to(id).emit('game:start', {
          gameType: 'arithmetic',
          players: playerList,
          round: game.round,
          firstQuestion: {
            questionId: firstQuestion.questionId,
            expression: firstQuestion.expression,
            round: firstQuestion.round,
          },
        })
      })

      scheduleRobotAnswer(rid, firstQuestion.questionId)

      roomManager.broadcastRoomState(rid, io)
    }

    /** 默写挑战：全员参战 → 发题 → 启动机器人定时器（难度对应：简单 40s / 普通 30s / 困难 20s） */
    function handleSpellingChallenge(rid, room, socket) {
      const playerIds = Object.values(room.roles).filter((id) => id !== null)

      if (playerIds.length < 1) {
        socket.emit('game:error', { message: '至少需要 1 名玩家选择角色' })
        return
      }

      const difficulty = room.spellingDifficulty || 'easy'
      const game = gameManager.createGame(rid, playerIds, 'spelling', difficulty)
      let firstQuestion
      try {
        firstQuestion = gameManager.generateSpellingQuestion(game)
      } catch (error) {
        roomManager.clearGame(rid)
        socket.emit('game:error', { message: error.message })
        return
      }

      const playerList = playerIds.map((id) => ({
        id,
        nickname: room.players[id]?.nickname || id,
        role: room.players[id]?.role || null,
      }))

      console.log(`[${ts()}] [challenge] 默写模式 (${difficulty}) — ${playerList.map((p) => p.nickname).join(', ')}`)

      playerIds.forEach((id) => {
        io.to(id).emit('game:start', {
          gameType: 'spelling',
          players: playerList,
          round: game.round,
          difficulty,
          firstQuestion: {
            questionId: firstQuestion.questionId,
            ttsText: firstQuestion.word,
            wordLength: firstQuestion.wordLength,
            blanks: firstQuestion.blanks,
            unsplashImageUrl: firstQuestion.unsplashImageUrl,
            round: firstQuestion.round,
          },
        })
      })

      scheduleRobotAnswer(rid, firstQuestion.questionId)

      roomManager.broadcastRoomState(rid, io)
    }

    /** RPS 挑战：1v1 对战 */
    function handleRpsChallenge(rid, room, socket, targetId) {
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

      console.log(`[${ts()}] [challenge] ${getNickname()} → ${target.nickname}`)

      io.to(socket.id).emit('game:start', {
        gameType: 'rps',
        opponent: { id: targetId, nickname: target.nickname, role: target.role },
        round: game.round,
      })
      io.to(targetId).emit('game:start', {
        gameType: 'rps',
        opponent: { id: socket.id, nickname: challenger.nickname, role: challenger.role },
        round: game.round,
      })

      roomManager.broadcastRoomState(rid, io)
    }

    /** 生成下一道算术题并广播，设置机器人定时器 */
    function emitNextArithmeticQuestion(rid, game) {
      const question = gameManager.generateQuestion(game)

      game.players.forEach((id) => {
        io.to(id).emit('game:question', {
          questionId: question.questionId,
          expression: question.expression,
          round: question.round,
        })
      })

      scheduleRobotAnswer(rid, question.questionId)
    }

    /** 算术轮结果广播（含 yourAnswer 每人视角） */
    function emitArithmeticRoundResult(rid, result) {
      const room = roomManager.getRoom(rid)
      const winnerNick = room?.players[result.winner]?.nickname || result.winner

      console.log(`[${ts()}] [round] 算术第${result.round}题 — ${winnerNick} 答对`)

      gameManager.getGame(rid)?.players.forEach((id) => {
        io.to(id).emit('game:roundResult', {
          gameType: 'arithmetic',
          round: result.round,
          questionId: result.questionId,
          expression: result.expression,
          correctAnswer: result.correctAnswer,
          yourAnswer: result.answeredBy?.[id],
          winner: result.winner,
          scores: result.scores,
        })
      })
    }

    /** 算术赛果广播 */
    function emitArithmeticMatchResult(rid, result) {
      const room = roomManager.getRoom(rid)
      const winnerNick = room?.players[result.matchWinner]?.nickname || result.matchWinner

      console.log(`[${ts()}] [match] 算术比赛结束 — 胜者: ${winnerNick}`)

      gameManager.getGame(rid)?.players.forEach((id) => {
        io.to(id).emit('game:matchResult', {
          gameType: 'arithmetic',
          matchWinner: result.matchWinner,
          scores: result.scores,
          ranking: result.ranking,
          history: result.history,
        })
      })

      roomManager.broadcastRoomState(rid, io)
    }

    // ==================== 默写广播 ====================

    /** 生成下一道默写题并广播，设置机器人定时器 */
    function emitNextSpellingQuestion(rid, game) {
      const question = gameManager.generateSpellingQuestion(game)

      game.players.forEach((id) => {
        io.to(id).emit('game:question', {
          questionId: question.questionId,
          ttsText: question.word,
          wordLength: question.wordLength,
          blanks: question.blanks,
          unsplashImageUrl: question.unsplashImageUrl,
          round: question.round,
        })
      })

      scheduleRobotAnswer(rid, question.questionId)
    }

    /** 默写轮结果广播（含 yourAnswer 每人视角） */
    function emitSpellingRoundResult(rid, result) {
      const room = roomManager.getRoom(rid)
      const winnerNick = room?.players[result.winner]?.nickname || result.winner

      console.log(`[${ts()}] [round] 默写第${result.round}题 — ${winnerNick} 答对`)

      gameManager.getGame(rid)?.players.forEach((id) => {
        io.to(id).emit('game:roundResult', {
          gameType: 'spelling',
          round: result.round,
          questionId: result.questionId,
          word: result.word,
          blanks: result.blanks,
          correctAnswer: result.correctAnswer,
          yourAnswer: result.answeredBy?.[id],
          winner: result.winner,
          scores: result.scores,
        })
      })
    }

    /** 默写赛果广播 */
    function emitSpellingMatchResult(rid, result) {
      const room = roomManager.getRoom(rid)
      const winnerNick = room?.players[result.matchWinner]?.nickname || result.matchWinner

      console.log(`[${ts()}] [match] 默写比赛结束 — 胜者: ${winnerNick}`)

      gameManager.getGame(rid)?.players.forEach((id) => {
        io.to(id).emit('game:matchResult', {
          gameType: 'spelling',
          matchWinner: result.matchWinner,
          scores: result.scores,
          ranking: result.ranking,
          history: result.history,
        })
      })

      roomManager.broadcastRoomState(rid, io)
    }

    /** 清除房间的机器人定时器 */
    function clearRobotTimer(rid) {
      if (robotTimers.has(rid)) {
        clearTimeout(robotTimers.get(rid))
        robotTimers.delete(rid)
      }
    }

    /** 设置机器人定时器（按游戏类型/难度自动作答） */
    function scheduleRobotAnswer(rid, questionId) {
      clearRobotTimer(rid)
      const game = gameManager.getGame(rid)
      if (!game) return

      const timeout = game.type === 'spelling' ? (SPELLING_TIMEOUT_MAP[game.difficulty] || SPELLING_TIMEOUT_MAP.easy) : ARITHMETIC_TIMEOUT
      const timer = setTimeout(() => {
        if (game.type === 'spelling') {
          const result = gameManager.handleRobotSpellingAnswer(rid, questionId)
          if (result) handleSpellingAnswerResult(rid, result)
        } else {
          const result = gameManager.handleRobotArithmeticAnswer(rid, questionId)
          if (result) handleArithmeticAnswerResult(rid, result)
        }
      }, timeout)
      robotTimers.set(rid, timer)
    }

    /** 统一处理算术答题结果（轮结果 / 赛果） */
    function handleArithmeticAnswerResult(rid, result) {
      if (result.action === 'round_result') {
        emitArithmeticRoundResult(rid, result)
        const game = gameManager.getGame(rid)
        if (game && game.status === 'playing') {
          emitNextArithmeticQuestion(rid, game)
        }
      } else if (result.action === 'match_result') {
        emitArithmeticMatchResult(rid, result)
      }
    }

    /** 统一处理默写答题结果（轮结果 / 赛果） */
    function handleSpellingAnswerResult(rid, result) {
      if (result.action === 'round_result') {
        emitSpellingRoundResult(rid, result)
        const game = gameManager.getGame(rid)
        if (game && game.status === 'playing') {
          emitNextSpellingQuestion(rid, game)
        }
      } else if (result.action === 'match_result') {
        emitSpellingMatchResult(rid, result)
      }
    }

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
        // 对手是机器人 → 立即为机器人出随机拳并结算
        if (game.players.includes(ROBOT_ID)) {
          const robotChoice = randomChoice()
          console.log(`[${ts()}] [move] ${getNickname()} → ${choice} | 机器人 → ${robotChoice}`)

          const robotResult = gameManager.submitMove(rid, ROBOT_ID, robotChoice)
          if (robotResult.action === 'round_result') emitRoundResult(game, robotResult)
          if (robotResult.action === 'match_result') emitMatchResult(game, robotResult, rid)
          return
        }

        console.log(`[${ts()}] [move] ${getNickname()} → ${choice} (等待对手)`)
        socket.emit('game:waiting')
        return
      }

      console.log(`[${ts()}] [move] ${getNickname()} → ${choice}`)

      if (result.action === 'round_result') emitRoundResult(game, result)
      if (result.action === 'match_result') {
        const room = roomManager.getRoom(rid)
        console.log(`[${ts()}] [result] 比赛结束 → 胜者: ${room?.players[result.matchWinner]?.nickname || result.matchWinner}`)
        emitMatchResult(game, result, rid)
      }
    })

    /** 提交答案 → 按游戏类型路由 */
    socket.on('game:answer', ({ questionId, answer } = {}) => {
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

      if (game.type === 'spelling') {
        return handleSpellingAnswer(rid, socket, questionId, answer)
      }

      return handleArithmeticAnswer(rid, socket, questionId, answer)
    })

    /** 算术答题处理 */
    function handleArithmeticAnswer(rid, socket, questionId, answer) {
      const result = gameManager.submitArithmeticAnswer(rid, socket.id, questionId, answer)

      if (result.action === 'error') {
        socket.emit('game:error', { message: result.message })
        return
      }

      if (result.action === 'waiting') {
        console.log(`[${ts()}] [answer] ${getNickname()} 答错 — ${result.expression} = ${result.correctAnswer}，提交: ${result.yourAnswer}`)

        socket.emit('game:answerAck', {
          questionId,
          correct: false,
          correctAnswer: result.correctAnswer,
          expression: result.expression,
          yourAnswer: result.yourAnswer,
        })
        return
      }

      clearRobotTimer(rid)
      handleArithmeticAnswerResult(rid, result)
    }

    /** 默写答题处理 */
    function handleSpellingAnswer(rid, socket, questionId, answer) {
      const result = gameManager.submitSpellingAnswer(rid, socket.id, questionId, answer)

      if (result.action === 'error') {
        socket.emit('game:error', { message: result.message })
        return
      }

      if (result.action === 'waiting') {
        console.log(`[${ts()}] [answer] ${getNickname()} 答错 — 正确: ${result.correctAnswer}，提交: ${result.yourAnswer}`)

        socket.emit('game:answerAck', {
          questionId,
          correct: false,
          correctAnswer: result.correctAnswer,
          word: result.word,
          yourAnswer: result.yourAnswer,
        })
        return
      }

      clearRobotTimer(rid)
      handleSpellingAnswerResult(rid, result)
    }

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
      if (!existingGame) {
        socket.emit('game:error', { message: '没有可重赛的已结束比赛' })
        return
      }
      if (existingGame.status !== 'match_end') {
        // 对方已先行发起重赛，游戏已重新开始，静默忽略
        return
      }

      const p1 = existingGame.players[0]
      const p2 = existingGame.players[1]

      roomManager.clearGame(rid)
      const game = gameManager.createGame(rid, [p1, p2], 'rps')

      console.log(`[${ts()}] [rematch] ${getNickname()}`)

      io.to(p1).emit('game:start', {
        gameType: 'rps',
        opponent: { id: p2, nickname: room.players[p2]?.nickname, role: room.players[p2]?.role },
        round: game.round,
      })
      io.to(p2).emit('game:start', {
        gameType: 'rps',
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

      console.log(`[${ts()}] [forfeit] ${getNickname()}`)

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
      if (!currentRoom) {
        console.log(`[${ts()}] [disconnect] ${socket.id} (未加入房间)`)
        return
      }
      const roomId = currentRoom

      console.log(`[${ts()}] [disconnect] ${socket.id} (${getNickname()}) ← ${roomId}`)

      cancelGameIfActive(roomId, socket.id)

      const state = roomManager.handleDisconnect(socket)
      if (state) {
        socket.to(`room:${roomId}`).emit('player:left', { socketId: socket.id })
        roomManager.broadcastRoomState(roomId, io)
      }
      currentRoom = null
    })

    /**
     * 处理玩家断线时的比赛取消
     * RPS：取消并通知对手；算术：不影响比赛继续
     * @param {string} roomId
     * @param {string} socketId
     */
    function cancelGameIfActive(roomId, socketId) {
      const game = gameManager.getGame(roomId)
      if (!game || game.status !== 'playing') return
      if (!game.players.includes(socketId)) return

      // 算术/默写比赛不受断线影响
      if (game.type === 'arithmetic' || game.type === 'spelling') return

      const room = roomManager.getRoom(roomId)

      gameManager.handleDisconnect(roomId, socketId)

      const otherPlayer = game.players.find((id) => id !== socketId)
      if (otherPlayer) {
        console.log(`[${ts()}] [cancel] ${room?.players[socketId]?.nickname || socketId} 离开，比赛取消`)
        io.to(otherPlayer).emit('game:cancelled', { message: '对手离开了房间' })
      }
    }
  })
}

module.exports = registerHandlers
