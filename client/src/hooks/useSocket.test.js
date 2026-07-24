import { io } from 'socket.io-client'
import useSocket from './useSocket'

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ id: 'configured-socket' })),
}))

describe('useSocket', () => {
  it('使用集中配置建立 Socket.IO 单例', () => {
    expect(useSocket()).toEqual({ id: 'configured-socket' })
    expect(io).toHaveBeenCalledTimes(1)
    expect(io).toHaveBeenCalledWith(
      `http://${window.location.hostname}:4000`,
      {
        transports: ['websocket', 'polling'],
        path: '/socket.io',
      },
    )
  })
})
