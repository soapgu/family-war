const mockSocket = {
  id: 'test-socket-id',
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  close: jest.fn(),
}

export default function useSocket() {
  return mockSocket
}
