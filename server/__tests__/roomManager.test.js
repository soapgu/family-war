const roomManager = require('../src/socket/roomManager')

/**
 * 创建 mock socket
 * @param {string} id
 * @returns {import('socket.io').Socket}
 */
function mockSocket(id = 's1') {
  return {
    id,
    join: jest.fn(),
    leave: jest.fn(),
  }
}

/**
 * 创建 mock Server (io)
 * @returns {import('socket.io').Server}
 */
function mockIO() {
  const emit = jest.fn()
  return {
    to: jest.fn(() => ({ emit })),
  }
}

beforeEach(() => {
  // 重置单例内部状态，保证每个用例隔离
  roomManager.rooms = {}
})

// ==================== 加入 / 离开房间 ====================

describe('joinRoom / leaveRoom', () => {
  it('加入房间时自动创建房间，返回房间状态', () => {
    const socket = mockSocket('s1')
    const state = roomManager.joinRoom(socket, 'default', '小明')

    expect(state).not.toBeNull()
    expect(state.id).toBe('default')
    const humans = state.players.filter((p) => p.id !== '__robot__')
    expect(humans).toHaveLength(1)
    expect(humans[0].nickname).toBe('小明')
    expect(humans[0].role).toBeNull()
    expect(socket.join).toHaveBeenCalledWith('room:default')
  })

  it('多人加入同一房间', () => {
    const s1 = mockSocket('s1')
    const s2 = mockSocket('s2')
    roomManager.joinRoom(s1, 'default', '小明')
    roomManager.joinRoom(s2, 'default', '小红')

    const state = roomManager.getRoomState('default')
    const humans = state.players.filter((p) => p.id !== '__robot__')
    expect(humans).toHaveLength(2)
  })

  it('离开房间释放角色', () => {
    const socket = mockSocket('s1')
    roomManager.joinRoom(socket, 'default', '小明')

    const { roomState } = roomManager.selectRole(socket, 'default', '爸爸')
    expect(roomState.roles['爸爸']).not.toBeNull()

    roomManager.leaveRoom(socket, 'default')

    // 剩下空房间，leaveRoom 返回 null
    const state = roomManager.getRoomState('default')
    expect(state).toBeNull()
  })

  it('最后一人离开时房间自动删除', () => {
    const socket = mockSocket('s1')
    roomManager.joinRoom(socket, 'default', '小明')
    roomManager.leaveRoom(socket, 'default')

    expect(roomManager.getRoom('default')).toBeNull()
  })

  it('离开不存在的房间返回 null', () => {
    const socket = mockSocket('s1')
    const result = roomManager.leaveRoom(socket, 'nonexistent')
    expect(result).toBeNull()
  })
})

// ==================== 角色选择 ====================

describe('selectRole / deselectRole', () => {
  it('成功选择角色', () => {
    const socket = mockSocket('s1')
    roomManager.joinRoom(socket, 'default', '小明')

    const { roomState } = roomManager.selectRole(socket, 'default', '爸爸')
    expect(roomState.roles['爸爸']).toMatchObject({ id: 's1', nickname: '小明' })
  })

  it('选择已被占用的角色返回错误', () => {
    const s1 = mockSocket('s1')
    const s2 = mockSocket('s2')
    roomManager.joinRoom(s1, 'default', '小明')
    roomManager.joinRoom(s2, 'default', '小红')

    roomManager.selectRole(s1, 'default', '爸爸')
    const result = roomManager.selectRole(s2, 'default', '爸爸')

    expect(result.error).toBe('该角色已被选择')
  })

  it('选择无效角色返回错误', () => {
    const socket = mockSocket('s1')
    roomManager.joinRoom(socket, 'default', '小明')

    const result = roomManager.selectRole(socket, 'default', '爷爷')
    expect(result.error).toBe('无效的角色')
  })

  it('玩家不在房间中选择角色返回错误', () => {
    // 先让一人加入创建房间
    const s1 = mockSocket('s1')
    roomManager.joinRoom(s1, 'default', '小明')
    // 另一个未加入的 socket 尝试选角色
    const s2 = mockSocket('s2')
    const result = roomManager.selectRole(s2, 'default', '爸爸')
    expect(result.error).toBe('你不在这个房间中')
  })

  it('切换到其他角色时释放旧角色', () => {
    const socket = mockSocket('s1')
    roomManager.joinRoom(socket, 'default', '小明')

    roomManager.selectRole(socket, 'default', '爸爸')
    const { roomState } = roomManager.selectRole(socket, 'default', '妈妈')

    // 爸爸位已释放
    expect(roomState.roles['爸爸']).toBeNull()
    expect(roomState.roles['妈妈']).toMatchObject({ id: 's1' })
  })

  it('放弃角色后角色位释放', () => {
    const socket = mockSocket('s1')
    roomManager.joinRoom(socket, 'default', '小明')
    roomManager.selectRole(socket, 'default', '爸爸')

    const { roomState } = roomManager.deselectRole(socket, 'default')
    expect(roomState.roles['爸爸']).toBeNull()
    const human = roomState.players.find((p) => p.id === 's1')
    expect(human.role).toBeNull()
  })

  it('在不存在的房间放弃角色返回错误', () => {
    const socket = mockSocket('s1')
    const result = roomManager.deselectRole(socket, 'nonexistent')
    expect(result.error).toBe('房间不存在')
  })
})

// ==================== 断线处理 ====================

describe('handleDisconnect', () => {
  it('断线后移除玩家并释放角色', () => {
    const s1 = mockSocket('s1')
    const s2 = mockSocket('s2')
    roomManager.joinRoom(s1, 'default', '小明')
    roomManager.joinRoom(s2, 'default', '小红')
    roomManager.selectRole(s1, 'default', '爸爸')
    roomManager.selectRole(s2, 'default', '妈妈')

    const state = roomManager.handleDisconnect(s1)

    // s1 被移除（剩余机器人和 s2）
    const humans = state.players.filter((p) => p.id !== '__robot__')
    expect(humans).toHaveLength(1)
    expect(humans[0].id).toBe('s2')
    // 爸爸角色释放
    expect(state.roles['爸爸']).toBeNull()
  })

  it('最后一人断线后房间被删除', () => {
    const socket = mockSocket('s1')
    roomManager.joinRoom(socket, 'default', '小明')

    const result = roomManager.handleDisconnect(socket)
    expect(result).toBeNull()
    expect(roomManager.getRoom('default')).toBeNull()
  })

  it('不在任何房间的 socket 断线返回 null', () => {
    const socket = mockSocket('s1')
    const result = roomManager.handleDisconnect(socket)
    expect(result).toBeNull()
  })
})

// ==================== 状态查询 ====================

describe('getRoomState', () => {
  it('返回可序列化的房间状态结构', () => {
    const socket = mockSocket('s1')
    roomManager.joinRoom(socket, 'default', '小明')
    roomManager.selectRole(socket, 'default', '爸爸')

    const state = roomManager.getRoomState('default')

    expect(state).toEqual({
      id: 'default',
      roles: {
        '爸爸': { id: 's1', nickname: '小明' },
        '妈妈': null,
        '儿子': null,
        '机器人': { id: '__robot__', nickname: '机器人' },
      },
      players: [
        { id: '__robot__', nickname: '机器人', role: '机器人', online: true },
        { id: 's1', nickname: '小明', role: '爸爸', online: true },
      ],
      game: null,
    })
  })

  it('不存在的房间返回 null', () => {
    expect(roomManager.getRoomState('nonexistent')).toBeNull()
  })
})

// ==================== 广播 ====================

describe('broadcastRoomState', () => {
  it('向房间所有人广播 room:state', () => {
    const socket = mockSocket('s1')
    roomManager.joinRoom(socket, 'default', '小明')

    const io = mockIO()
    roomManager.broadcastRoomState('default', io)

    expect(io.to).toHaveBeenCalledWith('room:default')
    expect(io.to('room:default').emit).toHaveBeenCalledWith(
      'room:state',
      expect.objectContaining({ id: 'default' })
    )
  })

  it('不存在的房间不广播', () => {
    const io = mockIO()
    roomManager.broadcastRoomState('nonexistent', io)
    expect(io.to).not.toHaveBeenCalled()
  })
})

// ==================== 管理接口 ====================

describe('getAdminStatus', () => {
  it('返回所有房间概览', () => {
    const s1 = mockSocket('s1')
    const s2 = mockSocket('s2')
    roomManager.joinRoom(s1, 'default', '小明')
    roomManager.joinRoom(s2, 'room2', '小红')

    const status = roomManager.getAdminStatus()

    expect(status).toHaveLength(2)
    const humanPlayer = status[0].players.find((p) => p.nickname === '小明')
    expect(humanPlayer.nickname).toBe('小明')
    expect(status[1].id).toBe('room2')
  })

  it('没有房间时返回空数组', () => {
    expect(roomManager.getAdminStatus()).toEqual([])
  })
})

// ==================== 游戏状态挂钩 ====================

describe('setGame / clearGame', () => {
  it('设置游戏对象到房间', () => {
    const socket = mockSocket('s1')
    roomManager.joinRoom(socket, 'default', '小明')

    const gameObj = { id: 'g1', status: 'playing' }
    roomManager.setGame('default', gameObj)

    const state = roomManager.getRoomState('default')
    expect(state.game).toEqual(gameObj)
  })

  it('清除房间的游戏对象', () => {
    const socket = mockSocket('s1')
    roomManager.joinRoom(socket, 'default', '小明')
    roomManager.setGame('default', { id: 'g1' })
    roomManager.clearGame('default')

    const state = roomManager.getRoomState('default')
    expect(state.game).toBeNull()
  })

  it('不存在的房间调用 setGame 不报错', () => {
    expect(() => roomManager.setGame('nonexistent', {})).not.toThrow()
  })
})
