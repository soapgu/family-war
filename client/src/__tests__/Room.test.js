import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import useSocket from '../hooks/useSocket'
import Room from '../pages/Room'

jest.mock('../hooks/useSocket')

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

function renderRoom() {
  return render(<BrowserRouter><Room /></BrowserRouter>)
}

/**
 * 触发 socket 事件，模拟服务器推送
 */
function triggerSocketEvent(event, data) {
  const socket = useSocket()
  const handler = socket.on.mock.calls.find(([e]) => e === event)?.[1]
  if (handler) handler(data)
}

const MOCK_ROOM_STATE = {
  id: 'default',
  roles: {
    '爸爸': null,
    '妈妈': { id: 's2', nickname: '小红' },
    '儿子': null,
  },
  players: [
    { id: 'test-socket-id', nickname: '小明', role: null, online: true },
    { id: 's2', nickname: '小红', role: '妈妈', online: true },
  ],
  game: null,
}

describe('Room', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders room title', () => {
    renderRoom()
    expect(screen.getByText('游戏房间')).toBeInTheDocument()
  })

  it('shows room id', () => {
    renderRoom()
    expect(screen.getByText(/default/)).toBeInTheDocument()
  })

  it('redirects to / after 3s if no room:state received', () => {
    jest.useFakeTimers()
    renderRoom()
    jest.advanceTimersByTime(3000)
    expect(mockNavigate).toHaveBeenCalledWith('/')
    jest.useRealTimers()
  })

  it('renders three role cards', () => {
    renderRoom()
    expect(screen.getByText('爸爸')).toBeInTheDocument()
    expect(screen.getByText('妈妈')).toBeInTheDocument()
    expect(screen.getByText('儿子')).toBeInTheDocument()
  })

  it('updates roles on room:state', async () => {
    renderRoom()
    triggerSocketEvent('room:state', MOCK_ROOM_STATE)

    await waitFor(() => expect(screen.getByText('已占用')).toBeInTheDocument())
    const freeLabels = screen.getAllByText('空闲')
    expect(freeLabels).toHaveLength(2)
  })

  it('emits role:select when clicking free role', async () => {
    const socket = useSocket()
    renderRoom()
    triggerSocketEvent('room:state', MOCK_ROOM_STATE)

    await userEvent.click(screen.getAllByRole('button')[0])
    expect(socket.emit).toHaveBeenCalledWith('role:select', { role: '爸爸' })
  })

  it('emits role:deselect when clicking own role', async () => {
    const socket = useSocket()
    renderRoom()

    const state = {
      ...MOCK_ROOM_STATE,
      roles: { ...MOCK_ROOM_STATE.roles, '儿子': { id: 'test-socket-id', nickname: '小明' } },
      players: MOCK_ROOM_STATE.players.map(p =>
        p.id === 'test-socket-id' ? { ...p, role: '儿子' } : p
      ),
    }
    triggerSocketEvent('room:state', state)

    // 等待角色更新
    await waitFor(() => expect(screen.getByText(/我/)).toBeInTheDocument())

    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[2])
    expect(socket.emit).toHaveBeenCalledWith('role:deselect')
  })

  it('does not emit when clicking role occupied by others', async () => {
    const socket = useSocket()
    renderRoom()
    triggerSocketEvent('room:state', MOCK_ROOM_STATE)

    await waitFor(() => expect(screen.getByText('已占用')).toBeInTheDocument())

    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[1])
    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('shows "我" on own role', async () => {
    renderRoom()
    const state = {
      ...MOCK_ROOM_STATE,
      roles: { ...MOCK_ROOM_STATE.roles, '爸爸': { id: 'test-socket-id', nickname: '小明' } },
      players: MOCK_ROOM_STATE.players.map(p =>
        p.id === 'test-socket-id' ? { ...p, role: '爸爸' } : p
      ),
    }
    triggerSocketEvent('room:state', state)

    await waitFor(() => expect(screen.getByText(/我/)).toBeInTheDocument())
  })
})
