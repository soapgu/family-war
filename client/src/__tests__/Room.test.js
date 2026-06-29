import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import useSocket from '../hooks/useSocket'
import Room from '../pages/Room'

jest.mock('../hooks/useSocket')

const MOCK_ROOM_STATE = {
  id: 'default',
  roles: {
    '爸爸': null,
    '妈妈': { id: 's2', nickname: '小红' },
    '儿子': null,
    '机器人': { id: '__robot__', nickname: '机器人' },
  },
  players: [
    { id: 'test-socket-id', nickname: '小明', role: null, online: true },
    { id: 's2', nickname: '小红', role: '妈妈', online: true },
    { id: '__robot__', nickname: '机器人', role: '机器人', online: true },
  ],
  game: null,
}

function renderRoom(roomState = MOCK_ROOM_STATE) {
  return render(
    <Room nickname="小明" roomState={roomState} onBack={jest.fn()} />
  )
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

  it('renders role cards', () => {
    renderRoom()
    expect(screen.getByText('爸爸')).toBeInTheDocument()
    expect(screen.getByText('妈妈')).toBeInTheDocument()
    expect(screen.getByText('儿子')).toBeInTheDocument()
    expect(screen.getAllByText('机器人').length).toBeGreaterThanOrEqual(1)
  })

  it('shows roles from state', () => {
    renderRoom()
    expect(screen.getByText('小红')).toBeInTheDocument()
    const freeLabels = screen.getAllByText('空闲')
    expect(freeLabels).toHaveLength(2)
  })

  it('emits role:select when clicking free role', async () => {
    const socket = useSocket()
    renderRoom()

    const cards = within(screen.getByTestId('role-cards'))
    await userEvent.click(cards.getByText('爸爸'))
    expect(socket.emit).toHaveBeenCalledWith('role:select', { role: '爸爸' })
  })

  it('emits role:deselect when clicking own role', async () => {
    const socket = useSocket()
    const state = {
      ...MOCK_ROOM_STATE,
      roles: { ...MOCK_ROOM_STATE.roles, '儿子': { id: 'test-socket-id', nickname: '小明' } },
      players: MOCK_ROOM_STATE.players.map(p =>
        p.id === 'test-socket-id' ? { ...p, role: '儿子' } : p
      ),
    }
    renderRoom(state)

    const cards = within(screen.getByTestId('role-cards'))
    await userEvent.click(cards.getByText('儿子'))
    expect(socket.emit).toHaveBeenCalledWith('role:deselect')
  })

  it('does not emit when clicking role occupied by others', async () => {
    const socket = useSocket()
    renderRoom()

    const cards = within(screen.getByTestId('role-cards'))
    await userEvent.click(cards.getByText('妈妈'))
    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('shows "我" on own role', () => {
    const state = {
      ...MOCK_ROOM_STATE,
      roles: { ...MOCK_ROOM_STATE.roles, '爸爸': { id: 'test-socket-id', nickname: '小明' } },
      players: MOCK_ROOM_STATE.players.map(p =>
        p.id === 'test-socket-id' ? { ...p, role: '爸爸' } : p
      ),
    }
    renderRoom(state)

    expect(screen.getByText(/我/)).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', async () => {
    const onBack = jest.fn()
    render(<Room nickname="小明" roomState={MOCK_ROOM_STATE} onBack={onBack} />)

    await userEvent.click(screen.getByText('返回首页'))
    expect(onBack).toHaveBeenCalled()
  })

  it('emits room:leave when exit button is clicked', async () => {
    const socket = useSocket()
    const onBack = jest.fn()
    render(<Room nickname="小明" roomState={MOCK_ROOM_STATE} onBack={onBack} />)

    await userEvent.click(screen.getByText('退出房间'))
    expect(socket.emit).toHaveBeenCalledWith('room:leave')
    expect(onBack).toHaveBeenCalled()
  })
})
