const BaseGameMode = require('./BaseGameMode')

/**
 * 出题抢答类游戏基类。
 *
 * 算术达人（ArithmeticGameMode）和英文默写（SpellingGameMode）都继承它。
 *
 * 共性流程：
 * - 有当前题 currentQuestion
 * - 有答题记录 answeredThisRound
 * - 每人每题只能答一次
 * - 答错返回 waiting（只给本人 answerAck）
 * - 答对加分，产生 round_result
 * - 达到胜利分数后产生 match_result
 * - 机器人超时后提交正确答案
 *
 * 子类只需负责：
 * - 如何生成题目（createNextQuestion）
 * - 如何标准化答案（normalizeAnswer）
 * - 如何判断答案正确（isCorrectAnswer）
 * - 如何构建 payload（buildQuestionPayload / buildWrongAnswerAck / createRoundSettlement）
 */
class QuizGameMode extends BaseGameMode {
  /**
   * 创建游戏：在基础状态上追加答题类专用字段。
   * @param {Object} params - 透传自 createBaseGame 的参数
   */
  createGame(params) {
    const game = this.createBaseGame(params)
    game.currentQuestion = null
    game.answeredThisRound = {}
    return game
  }

  /**
   * 统一处理答题类游戏的玩家输入。
   *
   * 校验链路：房间/游戏存在 → 比赛进行中 → 题目未过期 → 玩家资格 → 未重复作答
   * → 答案标准化 → 合法性校验 → 判对错 → 答错 waiting / 答对结算
   *
   * @param {{ roomId, room, game, playerId, input: { questionId, answer } }} params
   * @returns {{ action: string, ... }}
   */
  submitInput({ roomId, room, game, playerId, input }) {
    if (!room || !game || game.type !== this.type) {
      return { action: 'error', message: `${this.getDisplayName()}游戏不存在` }
    }

    if (game.status !== 'playing') {
      return { action: 'error', message: '比赛已结束' }
    }

    if (!game.currentQuestion || game.currentQuestion.questionId !== input.questionId) {
      return { action: 'error', message: '题目已过期' }
    }

    if (!game.players.includes(playerId)) {
      return { action: 'error', message: '你不是本局玩家' }
    }

    if (game.answeredThisRound[playerId] !== undefined) {
      return { action: 'error', message: '你已经回答过本题' }
    }

    // 交给子类做答案标准化（算术→Number，默写→String.trim）
    const normalizedAnswer = this.normalizeAnswer(input.answer)

    // 交给子类做合法性校验
    const validation = this.validateAnswer(normalizedAnswer)
    if (validation) {
      return validation
    }

    game.answeredThisRound[playerId] = normalizedAnswer

    // 答错：不进入下一题，等待其他玩家或机器人超时
    if (!this.isCorrectAnswer(game.currentQuestion, normalizedAnswer)) {
      return {
        action: 'waiting',
        ack: this.buildWrongAnswerAck({
          question: game.currentQuestion,
          answer: normalizedAnswer,
        }),
      }
    }

    // 答对：统一加分、写历史、判断是否结算
    return this.applyCorrectAnswer({
      roomId,
      room,
      game,
      playerId,
      answer: normalizedAnswer,
    })
  }

  /**
   * 答对后的统一处理。
   *
   * 步骤顺序很重要：
   * 1. 加分
   * 2. 创建本轮结算快照（由子类提供）
   * 3. 写入历史、清空 currentQuestion、轮次+1
   * 4. 判断是否达到胜分 → match_result 或 round_result
   *
   * @param {{ room, game, playerId }} params
   * @returns {{ action: 'round_result'|'match_result', result: Object }}
   */
  applyCorrectAnswer({ room, game, playerId }) {
    game.scores[playerId]++

    const settlement = this.createRoundSettlement({
      game,
      playerId,
    })

    game.history.push(settlement.historyItem)
    game.currentQuestion = null
    game.round++

    if (this.isMatchEnded(game, playerId)) {
      game.status = 'match_end'

      return {
        action: 'match_result',
        result: {
          gameType: this.type,
          matchWinner: playerId,
          scores: { ...game.scores },
          ranking: this.buildRanking({ game, room }),
          history: [...game.history],
          answeredBy: { ...game.answeredThisRound },
        },
      }
    }

    return {
      action: 'round_result',
      result: {
        ...settlement.result,
        scores: { ...game.scores },
        answeredBy: { ...game.answeredThisRound },
      },
    }
  }

  /**
   * 答题类游戏在当前题未结时且存在机器人时，需要启动机器人定时器。
   * @param {{ game: Object, robotId: string }} params
   * @returns {boolean}
   */
  shouldScheduleRobot({ game, robotId }) {
    return game.status === 'playing'
      && !!game.currentQuestion
      && game.players.includes(robotId)
  }

  /**
   * 机器人提交正确答案。
   * 机器人和真人走同一套 submitInput 流程，避免规则分叉。
   */
  handleRobotInput({ roomId, room, game, robotId, questionId }) {
    if (!game.currentQuestion || game.currentQuestion.questionId !== questionId) {
      return null
    }

    return this.submitInput({
      roomId,
      room,
      game,
      playerId: robotId,
      input: {
        questionId,
        answer: this.getRobotAnswer(game.currentQuestion),
      },
    })
  }

  /**
   * 答错 waiting 后的机器人调度意图。
   *
   * 默认不调整。
   * SpellingGameMode 会覆盖它：所有人类都答错后，如果剩余时间大于 5s，
   * 将机器人自动答题时间缩短到 5s。
   */
  getRobotScheduleAfterWaiting() {
    return null
  }

  // ==================== 子类必须实现的抽象方法 ====================

  /** 标准化答案。算术→Number(answer)，默写→String(answer).trim() */
  normalizeAnswer(answer) {
    return answer
  }

  /** 校验答案合法性。返回 null 表示合法，返回 { error: '...' } 表示非法。 */
  validateAnswer() {
    return null
  }

  /** 判断答案是否正确。 */
  isCorrectAnswer() {
    throw new Error(`${this.type}.isCorrectAnswer() not implemented`)
  }

  /** 构建答错 ack payload（发给答错的玩家）。 */
  buildWrongAnswerAck() {
    throw new Error(`${this.type}.buildWrongAnswerAck() not implemented`)
  }

  /**
   * 创建本轮结算快照。
   *
   * 这是玩法规则层的内部结算结果，返回 { historyItem, result }。
   * - historyItem：写入 game.history
   * - result：由 applyCorrectAnswer 扩展 scores/answeredBy 后继续流转
   * 不直接等同于 socket 对外 payload。
   */
  createRoundSettlement() {
    throw new Error(`${this.type}.createRoundSettlement() not implemented`)
  }

  /** 获取机器人应提交的正确答案。 */
  getRobotAnswer() {
    throw new Error(`${this.type}.getRobotAnswer() not implemented`)
  }

  /** 中文展示名，用于错误消息。例如"算术"、"默写"。 */
  getDisplayName() {
    return this.type
  }
}

module.exports = QuizGameMode
