const listeners = {}

export const mockSocket = {
  id: 'test-socket-id',
  on: vi.fn((event, cb) => { listeners[event] = cb }),
  off: vi.fn(),
  emit: vi.fn(),
  close: vi.fn(),
}

export function triggerSocketEvent(event, data) {
  listeners[event]?.(data)
}

export default function useSocket() {
  return mockSocket
}
