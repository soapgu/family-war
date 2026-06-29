const ROBOT_ID = '__robot__'
const ROBOT_ROLE = '机器人'

/**
 * 房间管理器（单例）
 * 管理房间、角色分配、玩家在线状态，纯内存操作。
 */
class RoomManager {
  constructor() {
    /** @type {Object<string, Room>} */
    this.rooms = {}
  }

  // ==================== 内部方法 ====================

  /**
   * 确保房间存在，不存在则创建
   * @param {string} roomId
   * @returns {Room}
   */
  _ensureRoom(roomId) {
    if (!this.rooms[roomId]) {
      this.rooms[roomId] = {
        id: roomId,
        // 角色 → socketId 映射，null 表示空闲
        roles: { '爸爸': null, '妈妈': null, '儿子': null, [ROBOT_ROLE]: ROBOT_ID },
        // socketId → 玩家信息
        players: {
          [ROBOT_ID]: {
            id: ROBOT_ID,
            nickname: ROBOT_ROLE,
            role: ROBOT_ROLE,
            online: true,
          },
        },
        // 进行中的游戏对象，由 gameManager 管理
        game: null,
      }
    }
    return this.rooms[roomId]
  }

  // ==================== 房间操作 ====================

  /**
   * 获取房间，不存在返回 null
   * @param {string} roomId
   * @returns {Room|null}
   */
  getRoom(roomId) {
    return this.rooms[roomId] || null
  }

  /**
   * 玩家加入房间
   * - 创建房间（如果不存在）
   * - 将 socket 加入 socket.io room
   * @param {import('socket.io').Socket} socket
   * @param {string} roomId
   * @param {string} nickname
   * @returns {RoomState|null}
   */
  joinRoom(socket, roomId, nickname) {
    const room = this._ensureRoom(roomId)

    room.players[socket.id] = {
      id: socket.id,
      nickname,
      role: null,
      online: true,
    }

    socket.join(`room:${roomId}`)
    return this.getRoomState(roomId)
  }

  /**
   * 玩家离开房间
   * - 释放占用的角色
   * - 空房间自动清理
   * @param {import('socket.io').Socket} socket
   * @param {string} roomId
   * @returns {RoomState|null}
   */
  leaveRoom(socket, roomId) {
    const room = this.getRoom(roomId)
    if (!room) return null

    const player = room.players[socket.id]
    if (player && player.role) {
      room.roles[player.role] = null
    }

    delete room.players[socket.id]
    socket.leave(`room:${roomId}`)

    // 房间没真人了，自动删除（排除机器人）
    if (Object.keys(room.players).filter((id) => id !== ROBOT_ID).length === 0) {
      delete this.rooms[roomId]
      return null
    }

    return this.getRoomState(roomId)
  }

  // ==================== 角色操作 ====================

  /**
   * 选择角色
   * - 验证角色有效且未被占用
   * - 如果已选其他角色，先释放
   * @param {import('socket.io').Socket} socket
   * @param {string} roomId
   * @param {string} role - 爸爸/妈妈/儿子
   * @returns {{ error?: string, roomState?: RoomState }}
   */
  selectRole(socket, roomId, role) {
    const room = this.getRoom(roomId)
    if (!room) return { error: '房间不存在' }

    if (role === ROBOT_ROLE) {
      return { error: '机器人角色不可被选择' }
    }

    if (!(role in room.roles)) {
      return { error: '无效的角色' }
    }

    // 角色已被其他人占用
    if (room.roles[role] !== null && room.roles[role] !== socket.id) {
      return { error: '该角色已被选择' }
    }

    const player = room.players[socket.id]
    if (!player) return { error: '你不在这个房间中' }

    // 释放旧角色（如果切换到不同角色）
    if (player.role && player.role !== role) {
      room.roles[player.role] = null
    }

    room.roles[role] = socket.id
    player.role = role

    return { roomState: this.getRoomState(roomId) }
  }

  /**
   * 放弃当前角色，回到未选择状态
   * @param {import('socket.io').Socket} socket
   * @param {string} roomId
   * @returns {{ error?: string, roomState?: RoomState }}
   */
  deselectRole(socket, roomId) {
    const room = this.getRoom(roomId)
    if (!room) return { error: '房间不存在' }

    const player = room.players[socket.id]
    if (!player) return { error: '你不在这个房间中' }

    if (player.role) {
      room.roles[player.role] = null
      player.role = null
    }

    return { roomState: this.getRoomState(roomId) }
  }

  // ==================== 状态获取与广播 ====================

  /**
   * 获取可广播给客户端的房间状态
   * 避免暴露内部 Map 结构，只暴露序列化后的信息
   * @param {string} roomId
   * @returns {RoomState|null}
   */
  getRoomState(roomId) {
    const room = this.getRoom(roomId)
    if (!room) return null

    return {
      id: room.id,
      roles: Object.fromEntries(
        Object.entries(room.roles).map(([role, socketId]) => [
          role,
          socketId
            ? { id: socketId, nickname: room.players[socketId]?.nickname }
            : null,
        ])
      ),
      players: Object.values(room.players).map((p) => ({
        id: p.id,
        nickname: p.nickname,
        role: p.role,
        online: p.online,
      })),
      game: room.game,
    }
  }

  /**
   * 向房间内所有玩家广播最新房间状态
   * @param {string} roomId
   * @param {import('socket.io').Server} io
   */
  broadcastRoomState(roomId, io) {
    const state = this.getRoomState(roomId)
    if (state) {
      io.to(`room:${roomId}`).emit('room:state', state)
    }
  }

  // ==================== 断线处理 ====================

  /**
   * 处理玩家断线
   * - 遍历所有房间查找该玩家
   * - 释放角色、清理玩家记录
   * - 空房间自动删除
   * @param {import('socket.io').Socket} socket
   * @returns {RoomState|null} - 断线玩家所在的房间新状态，null 表示房间已空
   */
  handleDisconnect(socket) {
    for (const roomId in this.rooms) {
      const room = this.rooms[roomId]
      if (room.players[socket.id]) {
        const player = room.players[socket.id]
        if (player.role) {
          room.roles[player.role] = null
        }
        delete room.players[socket.id]

        if (Object.keys(room.players).filter((id) => id !== ROBOT_ID).length === 0) {
          delete this.rooms[roomId]
          return null
        }

        return this.getRoomState(roomId)
      }
    }
    return null
  }

  // ==================== 管理接口 ====================

  /**
   * 获取所有房间概览（供管理后台使用）
   * @returns {AdminRoomInfo[]}
   */
  getAdminStatus() {
    return Object.values(this.rooms).map((room) => ({
      id: room.id,
      players: Object.values(room.players).map((p) => ({
        nickname: p.nickname,
        role: p.role,
        online: p.online,
      })),
      game: room.game,
    }))
  }

  // ==================== 游戏状态挂钩 ====================

  /**
   * 设置房间的游戏中状态（由 gameManager 调用）
   * @param {string} roomId
   * @param {object|null} game
   */
  setGame(roomId, game) {
    const room = this.getRoom(roomId)
    if (room) {
      room.game = game
    }
  }

  /**
   * 清除房间的游戏状态（由 gameManager 调用）
   * @param {string} roomId
   */
  clearGame(roomId) {
    const room = this.getRoom(roomId)
    if (room) {
      room.game = null
    }
  }
}

const roomManager = new RoomManager()
module.exports = roomManager
module.exports.ROBOT_ID = ROBOT_ID

// ==================== 类型定义 ====================

/**
 * @typedef {Object} Room
 * @property {string} id
 * @property {Object<string, string|null>} roles - 角色名 → socketId
 * @property {Object<string, Player>} players - socketId → 玩家信息
 * @property {object|null} game - 进行中的游戏
 *
 * @typedef {Object} Player
 * @property {string} id - socket id
 * @property {string} nickname
 * @property {string|null} role
 * @property {boolean} online
 *
 * @typedef {Object} RoomState
 * @property {string} id
 * @property {Object<string, {id: string, nickname: string}|null>} roles
 * @property {Array<{id: string, nickname: string, role: string|null, online: boolean}>} players
 * @property {object|null} game
 *
 * @typedef {Object} AdminRoomInfo
 * @property {string} id
 * @property {Array<{nickname: string, role: string|null, online: boolean}>} players
 * @property {object|null} game
 */
