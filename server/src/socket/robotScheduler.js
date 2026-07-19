function createRobotScheduler({ gameManager, onRobotResult }) {
  const timers = new Map()
  const timerEndAt = new Map()

  function clearTimer(roomId) {
    if (timers.has(roomId)) {
      clearTimeout(timers.get(roomId))
      timers.delete(roomId)
    }
    timerEndAt.delete(roomId)
  }

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
    schedule(roomId, questionId) {
      clearTimer(roomId)
      if (!gameManager.shouldScheduleRobot(roomId)) return
      const delayMs = gameManager.getRobotDelayMs(roomId)
      if (delayMs <= 0) return
      startTimer(roomId, questionId, delayMs)
    },

    clear(roomId) {
      clearTimer(roomId)
    },

    clearAll() {
      for (const roomId of timers.keys()) {
        clearTimeout(timers.get(roomId))
      }
      timers.clear()
      timerEndAt.clear()
    },

    getEndAt(roomId) {
      return timerEndAt.get(roomId)
    },

    getRemainingMs(roomId) {
      const endAt = timerEndAt.get(roomId)
      return endAt ? Math.max(0, endAt - Date.now()) : 0
    },

    accelerate(roomId, questionId, delayMs, { onlyIfRemainingGreaterThanMs } = {}) {
      const remaining = timerEndAt.has(roomId) ? Math.max(0, timerEndAt.get(roomId) - Date.now()) : 0
      if (onlyIfRemainingGreaterThanMs != null && remaining <= onlyIfRemainingGreaterThanMs) return
      clearTimer(roomId)
      startTimer(roomId, questionId, delayMs)
    },
  }
}

module.exports = { createRobotScheduler }
