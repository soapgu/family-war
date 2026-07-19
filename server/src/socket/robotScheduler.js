/**
 * v3.1 Phase 1 重构 — 从 handler.js 拆分的机器人定时调度器。
 *
 * 职责：
 * - schedule(roomId, questionId)：启动机器人定时器（延迟从 gameManager.getRobotDelayMs 获取）
 * - clear(roomId)：取消指定房间的定时器
 * - clearAll()：取消所有房间的定时器
 * - accelerate(roomId, questionId, delayMs, opts)：用更短延迟重新调度（支持 onlyIfRemainingGreaterThanMs 条件）
 * - getEndAt(roomId) / getRemainingMs(roomId)：查询定时器状态（用于前端倒计时）
 *
 * 使用 Map 管理房间级定时器，每个房间同时最多一个有效定时器。
 * 重复 schedule 会先 clear 再重建。
 *
 * @typedef {Object} GameManagerLike
 * @property {(roomId: string) => boolean} shouldScheduleRobot
 * @property {(roomId: string) => number} getRobotDelayMs
 * @property {(roomId: string, questionId: string) => Object|null} handleRobotInput
 *
 * @param {{ gameManager: GameManagerLike, onRobotResult: (rid: string, result: Object) => void }} params
 * @returns {{
 *   schedule: (roomId: string, questionId: string) => void,
 *   clear: (roomId: string) => void,
 *   clearAll: () => void,
 *   getEndAt: (roomId: string) => (number|undefined),
 *   getRemainingMs: (roomId: string) => number,
 *   accelerate: (roomId: string, questionId: string, delayMs: number, opts?: { onlyIfRemainingGreaterThanMs?: number }) => void,
 * }}
 */
function createRobotScheduler({ gameManager, onRobotResult }) {
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const timers = new Map()
  /** @type {Map<string, number>} 定时器预期结束时间戳 */
  const timerEndAt = new Map()

  /**
   * 移除指定房间的定时器。
   * @param {string} roomId
   */
  function clearTimer(roomId) {
    if (timers.has(roomId)) {
      clearTimeout(timers.get(roomId))
      timers.delete(roomId)
    }
    timerEndAt.delete(roomId)
  }

  /**
   * 启动定时器，到期后调用 gameManager.handleRobotInput 并通过 onRobotResult 回传结果。
   * @param {string} roomId
   * @param {string} questionId
   * @param {number} delayMs
   */
  function startTimer(roomId, questionId, delayMs) {
    timerEndAt.set(roomId, Date.now() + delayMs)
    const timer = setTimeout(() => {
      timers.delete(roomId)
      timerEndAt.delete(roomId)
      const result = gameManager.handleRobotInput(roomId, questionId)
      if (result) onRobotResult(roomId, result)
    }, delayMs)
    timers.set(roomId, timer)
  }

  return {
    /**
     * 创建新定时器。先清理旧定时器，再经 shouldScheduleRobot 门禁判断是否需要调度。
     * @param {string} roomId
     * @param {string} questionId
     */
    schedule(roomId, questionId) {
      clearTimer(roomId)
      if (!gameManager.shouldScheduleRobot(roomId)) return
      const delayMs = gameManager.getRobotDelayMs(roomId)
      if (delayMs <= 0) return
      startTimer(roomId, questionId, delayMs)
    },

    /**
     * 取消指定房间的定时器。
     * @param {string} roomId
     */
    clear(roomId) {
      clearTimer(roomId)
    },

    /** 取消所有房间的定时器。 */
    clearAll() {
      for (const roomId of timers.keys()) {
        clearTimeout(timers.get(roomId))
      }
      timers.clear()
      timerEndAt.clear()
    },

    /**
     * 获取指定房间定时器的预期结束时间戳。
     * @param {string} roomId
     * @returns {number|undefined}
     */
    getEndAt(roomId) {
      return timerEndAt.get(roomId)
    },

    /**
     * 获取指定房间定时器的剩余毫秒数。未调度时返回 0。
     * @param {string} roomId
     * @returns {number}
     */
    getRemainingMs(roomId) {
      const endAt = timerEndAt.get(roomId)
      return endAt ? Math.max(0, endAt - Date.now()) : 0
    },

    /**
     * 用更短延迟重新调度。可选 onlyIfRemainingGreaterThanMs 条件：
     * 当前剩余时间大于该值时执行加速，否则跳过。
     * @param {string} roomId
     * @param {string} questionId
     * @param {number} delayMs
     * @param {{ onlyIfRemainingGreaterThanMs?: number }} [opts]
     */
    accelerate(roomId, questionId, delayMs, { onlyIfRemainingGreaterThanMs } = {}) {
      const remaining = timerEndAt.has(roomId) ? Math.max(0, timerEndAt.get(roomId) - Date.now()) : 0
      if (onlyIfRemainingGreaterThanMs != null && remaining <= onlyIfRemainingGreaterThanMs) return
      clearTimer(roomId)
      startTimer(roomId, questionId, delayMs)
    },
  }
}

module.exports = { createRobotScheduler }
