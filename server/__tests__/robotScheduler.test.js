const { createRobotScheduler } = require('../src/socket/robotScheduler')

jest.useFakeTimers()

const RID = 'room1'
const QID = 'q1'

function mockGameManager(overrides = {}) {
  return {
    shouldScheduleRobot: jest.fn(() => true),
    getRobotDelayMs: jest.fn(() => 20000),
    handleRobotInput: jest.fn(() => ({ action: 'round_result', result: { winner: '__robot__' } })),
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllTimers()
})

describe('schedule', () => {
  it('创建定时器并在到期时调用 handleRobotInput', () => {
    const gm = mockGameManager()
    const onResult = jest.fn()
    const rs = createRobotScheduler({ gameManager: gm, onRobotResult: onResult })

    rs.schedule(RID, QID)
    expect(gm.shouldScheduleRobot).toHaveBeenCalledWith(RID)
    expect(gm.getRobotDelayMs).toHaveBeenCalledWith(RID)

    jest.advanceTimersByTime(20000)
    expect(gm.handleRobotInput).toHaveBeenCalledWith(RID, QID)
    expect(onResult).toHaveBeenCalledWith(RID, { action: 'round_result', result: { winner: '__robot__' } })
  })

  it('shouldScheduleRobot 返回 false 时跳过', () => {
    const gm = mockGameManager({ shouldScheduleRobot: jest.fn(() => false) })
    const onResult = jest.fn()
    const rs = createRobotScheduler({ gameManager: gm, onRobotResult: onResult })

    rs.schedule(RID, QID)
    expect(gm.handleRobotInput).not.toHaveBeenCalled()
    jest.advanceTimersByTime(20000)
    expect(gm.handleRobotInput).not.toHaveBeenCalled()
  })

  it('getRobotDelayMs <= 0 时跳过', () => {
    const gm = mockGameManager({ getRobotDelayMs: jest.fn(() => 0) })
    const rs = createRobotScheduler({ gameManager: gm, onRobotResult: jest.fn() })

    rs.schedule(RID, QID)
    jest.advanceTimersByTime(100)
    expect(gm.handleRobotInput).not.toHaveBeenCalled()
  })

  it('重复 schedule 先 clear 再重建', () => {
    const gm = mockGameManager()
    const rs = createRobotScheduler({ gameManager: gm, onRobotResult: jest.fn() })

    rs.schedule(RID, QID)
    rs.schedule(RID, 'q2')
    jest.advanceTimersByTime(20000)
    expect(gm.handleRobotInput).toHaveBeenCalledWith(RID, 'q2')
    expect(gm.handleRobotInput).not.toHaveBeenCalledWith(RID, QID)
  })
})

describe('clear', () => {
  it('移除定时器，回调不被执行', () => {
    const gm = mockGameManager()
    const onResult = jest.fn()
    const rs = createRobotScheduler({ gameManager: gm, onRobotResult: onResult })

    rs.schedule(RID, QID)
    rs.clear(RID)
    jest.advanceTimersByTime(20000)
    expect(gm.handleRobotInput).not.toHaveBeenCalled()
  })

  it('清除后 getEndAt 返回 undefined', () => {
    const rs = createRobotScheduler({ gameManager: mockGameManager(), onRobotResult: jest.fn() })
    rs.schedule(RID, QID)
    rs.clear(RID)
    expect(rs.getEndAt(RID)).toBeUndefined()
  })
})

describe('clearAll', () => {
  it('清除所有房间定时器', () => {
    const gm = mockGameManager()
    const rs = createRobotScheduler({ gameManager: gm, onRobotResult: jest.fn() })

    rs.schedule('r1', QID)
    rs.schedule('r2', QID)
    rs.clearAll()
    jest.advanceTimersByTime(20000)
    expect(gm.handleRobotInput).not.toHaveBeenCalled()
  })
})

describe('getEndAt / getRemainingMs', () => {
  it('getEndAt 返回结束时间戳', () => {
    const rs = createRobotScheduler({ gameManager: mockGameManager(), onRobotResult: jest.fn() })
    rs.schedule(RID, QID)
    expect(rs.getEndAt(RID)).toBeGreaterThan(Date.now())
  })

  it('getRemainingMs 返回正数', () => {
    const rs = createRobotScheduler({ gameManager: mockGameManager(), onRobotResult: jest.fn() })
    rs.schedule(RID, QID)
    expect(rs.getRemainingMs(RID)).toBeGreaterThan(0)
  })

  it('未调度时返回 0', () => {
    const rs = createRobotScheduler({ gameManager: mockGameManager(), onRobotResult: jest.fn() })
    expect(rs.getRemainingMs(RID)).toBe(0)
  })

  it('清除后返回 0', () => {
    const rs = createRobotScheduler({ gameManager: mockGameManager(), onRobotResult: jest.fn() })
    rs.schedule(RID, QID)
    rs.clear(RID)
    expect(rs.getRemainingMs(RID)).toBe(0)
  })
})

describe('accelerate', () => {
  it('用更短延迟重新调度', () => {
    const gm = mockGameManager()
    const onResult = jest.fn()
    const rs = createRobotScheduler({ gameManager: gm, onRobotResult: onResult })

    rs.schedule(RID, QID)
    rs.accelerate(RID, QID, 5000)
    jest.advanceTimersByTime(5000)
    expect(gm.handleRobotInput).toHaveBeenCalled()
  })

  it('onlyIfRemainingGreaterThanMs 满足时执行', () => {
    const gm = mockGameManager({ getRobotDelayMs: jest.fn(() => 100000) })
    const onResult = jest.fn()
    const rs = createRobotScheduler({ gameManager: gm, onRobotResult: onResult })

    rs.schedule(RID, QID)
    rs.accelerate(RID, QID, 5000, { onlyIfRemainingGreaterThanMs: 80000 })
    jest.advanceTimersByTime(5000)
    expect(gm.handleRobotInput).toHaveBeenCalled()
  })

  it('onlyIfRemainingGreaterThanMs 不满足时跳过', () => {
    const gm = mockGameManager({ getRobotDelayMs: jest.fn(() => 5000) })
    const onResult = jest.fn()
    const rs = createRobotScheduler({ gameManager: gm, onRobotResult: onResult })

    rs.schedule(RID, QID)
    // 剩余 5000ms ≤ 20000 → accelerate 跳过，不改定时器
    rs.accelerate(RID, QID, 1000, { onlyIfRemainingGreaterThanMs: 20000 })
    jest.advanceTimersByTime(1000)
    expect(gm.handleRobotInput).toHaveBeenCalledTimes(0)
    jest.advanceTimersByTime(4000)
    expect(gm.handleRobotInput).toHaveBeenCalledTimes(1)
  })

  it('handleRobotInput 返回 null 时不调 onRobotResult', () => {
    const gm = mockGameManager({ handleRobotInput: jest.fn(() => null) })
    const onResult = jest.fn()
    const rs = createRobotScheduler({ gameManager: gm, onRobotResult: onResult })

    rs.schedule(RID, QID)
    jest.advanceTimersByTime(20000)
    expect(onResult).not.toHaveBeenCalled()
  })
})
