import { act, render, screen, within } from '@testing-library/react'
import { App } from 'antd'
import userEvent from '@testing-library/user-event'
import useSocket, { triggerSocketEvent } from '../hooks/useSocket'
import Room from '../pages/Room'

vi.mock('../hooks/useSocket')
vi.mock('../components/SpellingBoard', () => ({
  default: ({ gameInfo, onFinish }) => (
    <div>
      <div>默写面板：{gameInfo.firstQuestion?.ttsText}</div>
      <button type="button" onClick={onFinish}>默写返回房间</button>
    </div>
  ),
}))
vi.mock('../components/ArithmeticBoard', () => ({
  default: ({ onFinish }) => (
    <div>
      <div>算术面板</div>
      <button type="button" onClick={onFinish}>算术返回房间</button>
    </div>
  ),
}))

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
    <Room nickname="小明" roomState={roomState} onBack={vi.fn()} />
  )
}

describe('Room', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    const onBack = vi.fn()
    render(<App><Room nickname="小明" roomState={MOCK_ROOM_STATE} onBack={onBack} /></App>)

    await userEvent.click(screen.getByText('返回首页'))
    expect(onBack).toHaveBeenCalled()
  })

  it('emits room:leave when exit button is clicked', async () => {
    const socket = useSocket()
    const onBack = vi.fn()
    render(<App><Room nickname="小明" roomState={MOCK_ROOM_STATE} onBack={onBack} /></App>)

    await userEvent.click(screen.getByText('退出房间'))
    expect(socket.emit).toHaveBeenCalledWith('room:leave')
    expect(onBack).toHaveBeenCalled()
  })

  it('切换默写模式时携带默认难度', async () => {
    const socket = useSocket()
    renderRoom({ ...MOCK_ROOM_STATE, gameMode: 'rps' })
    await userEvent.click(screen.getByText('🔤 默写'))
    expect(socket.emit).toHaveBeenCalledWith('game:setMode', { mode: 'spelling', difficulty: 'easy' })
  })

  it('默写模式可以切换难度', async () => {
    const socket = useSocket()
    renderRoom({ ...MOCK_ROOM_STATE, gameMode: 'spelling', spellingDifficulty: 'easy' })
    await userEvent.click(screen.getByText('HARD'))
    expect(socket.emit).toHaveBeenCalledWith('game:setMode', { mode: 'spelling', difficulty: 'hard' })
  })

  it('已选角色时可以开始默写比赛', async () => {
    const socket = useSocket()
    const state = {
      ...MOCK_ROOM_STATE,
      gameMode: 'spelling',
      spellingDifficulty: 'normal',
      roles: { ...MOCK_ROOM_STATE.roles, '爸爸': { id: 'test-socket-id', nickname: '小明' } },
      players: MOCK_ROOM_STATE.players.map((player) => (
        player.id === 'test-socket-id' ? { ...player, role: '爸爸' } : player
      )),
    }
    renderRoom(state)
    await userEvent.click(screen.getByRole('button', { name: '开始默写比赛' }))
    expect(socket.emit).toHaveBeenCalledWith('game:challenge', { mode: 'spelling' })
  })

  it('默写 game:start 渲染 SpellingBoard', async () => {
    renderRoom({ ...MOCK_ROOM_STATE, gameMode: 'spelling', spellingDifficulty: 'easy' })
    act(() => {
      triggerSocketEvent('game:start', {
        gameType: 'spelling',
        players: MOCK_ROOM_STATE.players,
        difficulty: 'easy',
        firstQuestion: { questionId: 'q1', ttsText: 'classroom' },
      })
    })
    expect(await screen.findByText('默写面板：classroom')).toBeInTheDocument()
  })

  it('默写返回房间时恢复房间 BGM', async () => {
    const onReturnToRoom = vi.fn()
    render(
      <Room
        nickname="小明"
        roomState={{ ...MOCK_ROOM_STATE, gameMode: 'spelling', spellingDifficulty: 'easy' }}
        onBack={vi.fn()}
        onReturnToRoom={onReturnToRoom}
      />
    )
    act(() => {
      triggerSocketEvent('game:start', {
        gameType: 'spelling',
        players: MOCK_ROOM_STATE.players,
        difficulty: 'easy',
        firstQuestion: { questionId: 'q1', ttsText: 'classroom' },
      })
    })

    await userEvent.click(await screen.findByText('默写返回房间'))
    expect(onReturnToRoom).toHaveBeenCalledOnce()
    expect(screen.queryByText('默写面板：classroom')).not.toBeInTheDocument()
  })

  it('算术返回房间时恢复房间 BGM', async () => {
    const onReturnToRoom = vi.fn()
    render(
      <Room
        nickname="小明"
        roomState={{ ...MOCK_ROOM_STATE, gameMode: 'arithmetic' }}
        onBack={vi.fn()}
        onReturnToRoom={onReturnToRoom}
      />
    )
    act(() => {
      triggerSocketEvent('game:start', {
        gameType: 'arithmetic',
        players: MOCK_ROOM_STATE.players,
      })
    })

    await userEvent.click(await screen.findByText('算术返回房间'))
    expect(onReturnToRoom).toHaveBeenCalledOnce()
    expect(screen.queryByText('算术面板')).not.toBeInTheDocument()
  })
})

describe('Room 断线重连', () => {
  it('room:state 无 game 时清除 gameInfo', () => {
    const { rerender } = render(
      <App>
        <Room
          nickname="小明"
          roomState={{ ...MOCK_ROOM_STATE, gameMode: 'arithmetic', game: { status: 'playing', type: 'arithmetic' } }}
          onBack={vi.fn()}
        />
      </App>
    )

    act(() => {
      triggerSocketEvent('game:start', {
        gameType: 'arithmetic',
        players: MOCK_ROOM_STATE.players,
      })
    })
    expect(screen.getByText('算术面板')).toBeInTheDocument()

    rerender(
      <App>
        <Room
          nickname="小明"
          roomState={{ ...MOCK_ROOM_STATE, game: null, gameMode: 'arithmetic' }}
          onBack={vi.fn()}
        />
      </App>
    )

    expect(screen.queryByText('算术面板')).not.toBeInTheDocument()
    expect(screen.getByText('选择角色')).toBeInTheDocument()
  })
})
