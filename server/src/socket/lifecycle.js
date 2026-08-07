const logger = require('../logger')

/**
 * v3.6 Phase 2 步骤 2c - 统一对局清理入口（带 gameId 防护）。
 *
 * 落实 docs/acceptance/v3.6/lifecycle-design.md 第 6 节统一清理契约：
 * 所有认输、离开、断线、终局替换和异常收敛都应经由本入口清理对局。
 * 入口集中完成「快照 -> gameId 校验 -> 清机器人调度 -> 清 room.game ->
 * 按策略通知仍在线真人参赛者」六步，保证同一旧对局只清理一次，且旧清理
 * 请求不得误伤随后创建的新对局。
 *
 * 设计要点：
 * - gameId 防护：room.game.id 与 expectedGameId 不一致视为旧清理请求，整体 no-op，
 *   既实现「同一 gameId 重复清理幂等」，又实现「旧清理不误清新局」。
 * - 通知对象筛选：从快照 game.players 过滤掉机器人；再与当前 room.players 取交集，
 *   确保只通知仍在线真人；排除发起者（excludeSocketId）。机器人不接收取消通知。
 * - 同步单线程模型下步骤 2/4 的 gameId 校验等价，无需原子化。
 *
 * 注：robotScheduler 内部的 gameId 绑定（旧定时器回调不推进新对局）属于 2h，
 * 本入口仅同步调用 robotScheduler.clear(roomId)。
 *
 * @typedef {Object} LifecycleDeps
 * @property {import('socket.io').Server} io
 * @property {Object} roomManager
 * @property {Object} gameManager
 * @property {{ clear: (roomId: string) => void }} robotScheduler
 * @property {string} ROBOT_ID
 */

/**
 * 统一对局清理入口。依赖通过构造函数注入，与 RoomManager/GameManager 风格一致；
 * 因 io 为 per-server 实例，导出 class 本身，由 handler 内 `new Lifecycle(...)` 创建。
 */
class Lifecycle {
  /**
   * @param {LifecycleDeps} deps
   */
  constructor({ io, roomManager, gameManager, robotScheduler, ROBOT_ID }) {
    this.io = io
    this.roomManager = roomManager
    this.gameManager = gameManager
    this.robotScheduler = robotScheduler
    this.ROBOT_ID = ROBOT_ID
  }

  /**
   * 统一对局清理入口（design §6 六步契约）。
   *
   * @param {string} roomId
   * @param {string} expectedGameId 预期对局 id；与 room.game.id 不符视为旧请求，整体 no-op
   * @param {{ reason?: string, notify?: { event: string, message: string, excludeSocketId?: string } | null }} [opts]
   * @returns {{ cleaned: boolean, stale: boolean, notified: string[] }}
   */
  cleanupGame(roomId, expectedGameId, { reason, notify } = {}) {
    const room = this.roomManager.getRoom(roomId)
    const game = room ? room.game : null

    // §6 步骤2：gameId 校验。room.game 已清/null 或 id 不符均视为旧清理请求。
    if (!game || game.id !== expectedGameId) {
      logger.info(`[cleanup] room=${roomId} game=null type=- result=stale reason=${expectedGameId}≠${game ? game.id : 'null'}`)
      return { cleaned: false, stale: true, notified: [] }
    }

    // §6 步骤1：保存真人参与者快照（机器人不通知）。在清理前快照，清理后仍可据此通知。
    const humanParticipants = game.players.filter((id) => id !== this.ROBOT_ID)

    // §6 步骤3：清除与该对局绑定的机器人任务。
    this.robotScheduler.clear(roomId)

    // §6 步骤4：仅在当前对局仍是预期对局时清 room.game（同步单线程下步骤2后不会改变）。
    this.roomManager.clearGame(roomId)

    // §6 步骤5：按通知策略向仍在线真人参赛者各发送一次通知。
    const notified = []
    if (notify) {
      const recipients = humanParticipants.filter(
        (id) => id !== notify.excludeSocketId && room.players && room.players[id]
      )
      recipients.forEach((id) => {
        this.io.to(id).emit(notify.event, { message: notify.message })
        notified.push(id)
      })
    }

    logger.info(`[cleanup] room=${roomId} game=${game.id} type=${game.type} op=- result=cleaned reason=${reason || '-'} notified=${notified.length}`)
    return { cleaned: true, stale: false, notified }
  }
}

module.exports = { Lifecycle }
