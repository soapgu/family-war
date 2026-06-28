const listeners = {}

const mockSocket = {
  id: 'test-socket-id',
  on: jest.fn((event, cb) => { listeners[event] = cb }),
  off: jest.fn(),
  emit: jest.fn(),
  close: jest.fn(),
}

export function triggerSocketEvent(event, data) {
  listeners[event]?.(data)
}

export default function useSocket() {
  return mockSocket
}
