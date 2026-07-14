import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import useSocket from '../hooks/useSocket'
import ArithmeticBoard from '../components/ArithmeticBoard'

vi.mock('../hooks/useSocket')

function emitSocketEvent(socket, event, data) {
  const cb = socket.on.mock.calls.find(([e]) => e === event)?.[1]
  if (cb) cb(data)
}

const PLAYERS = [
  { id: 's1', nickname: '小明', role: '爸爸' },
  { id: '__robot__', nickname: '机器人', role: '机器人' },
]

const GAME_INFO = { players: PLAYERS }

function renderBoard() {
  return render(<ArithmeticBoard gameInfo={GAME_INFO} onFinish={vi.fn()} />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('renders title', () => {
  renderBoard()
  expect(screen.getByText('🧮 算术达人模式')).toBeInTheDocument()
})

it('shows players and scores from gameInfo', () => {
  renderBoard()
  expect(screen.getAllByText(/小明/).length).toBeGreaterThanOrEqual(1)
  expect(screen.getAllByText(/机器人/).length).toBeGreaterThanOrEqual(1)
})

it('shows leaderboard with scores from gameInfo', () => {
  renderBoard()
  const scores = screen.getAllByText(/\d+分/)
  expect(scores.length).toBeGreaterThanOrEqual(2)
})

it('shows 等待题目 initially', () => {
  renderBoard()
  expect(screen.getByText('等待题目…')).toBeInTheDocument()
})

it('shows question on game:question', async () => {
  const socket = useSocket()
  renderBoard()
  await waitFor(() => emitSocketEvent(socket, 'game:question', { questionId: 'q1', expression: '12 + 34', round: 1 }))
  expect(await screen.findByText('12 + 34 = ?')).toBeInTheDocument()
  expect(screen.getByText('第 1 题')).toBeInTheDocument()
})

it('updates leaderboard on game:roundResult', async () => {
  const socket = useSocket()
  renderBoard()
  await waitFor(() => emitSocketEvent(socket, 'game:question', { questionId: 'q1', expression: '12 + 34', round: 1 }))
  await waitFor(() => emitSocketEvent(socket, 'game:roundResult', {
    gameType: 'arithmetic', round: 1, questionId: 'q1', expression: '12 + 34',
    correctAnswer: 46, yourAnswer: 46, winner: 's1', scores: { s1: 1, __robot__: 0 },
  }))
  expect(await screen.findByText('✅ 正确！')).toBeInTheDocument()
  expect(screen.getByText('1分')).toBeInTheDocument()
})

it('shows wrong feedback on wrong answer roundResult', async () => {
  const socket = useSocket()
  renderBoard()
  await waitFor(() => emitSocketEvent(socket, 'game:question', { questionId: 'q1', expression: '12 + 34', round: 1 }))
  await waitFor(() => emitSocketEvent(socket, 'game:roundResult', {
    gameType: 'arithmetic', round: 1, questionId: 'q1', expression: '12 + 34',
    correctAnswer: 46, yourAnswer: 99, winner: '__robot__', scores: { s1: 0, __robot__: 1 },
  }))
  expect(await screen.findByText('❌ 错误')).toBeInTheDocument()
})

it('emits game:answer on submit', async () => {
  const socket = useSocket()
  renderBoard()
  await waitFor(() => emitSocketEvent(socket, 'game:question', { questionId: 'q1', expression: '12 + 34', round: 1 }))
  const input = await screen.findByPlaceholderText('输入答案')
  fireEvent.change(input, { target: { value: '46' } })
  fireEvent.click(screen.getByRole('button', { name: /提\s*交/ }))
  expect(socket.emit).toHaveBeenCalledWith('game:answer', { questionId: 'q1', answer: 46 })
})

it('disables input after correct answer', async () => {
  const socket = useSocket()
  renderBoard()
  await waitFor(() => emitSocketEvent(socket, 'game:question', { questionId: 'q1', expression: '12 + 34', round: 1 }))
  await waitFor(() => emitSocketEvent(socket, 'game:roundResult', {
    gameType: 'arithmetic', round: 1, questionId: 'q1', expression: '12 + 34',
    correctAnswer: 46, yourAnswer: 46, winner: 's1', scores: { s1: 1, __robot__: 0 },
  }))
  await waitFor(() => {
    expect(screen.getByPlaceholderText('输入答案')).toBeDisabled()
  })
})

it('shows match result on game:matchResult', async () => {
  const socket = useSocket()
  renderBoard()
  await waitFor(() => emitSocketEvent(socket, 'game:matchResult', {
    gameType: 'arithmetic', matchWinner: socket.id, scores: { 'test-socket-id': 5, __robot__: 3 },
    ranking: [
      { rank: 1, playerId: 'test-socket-id', nickname: '小明', score: 5 },
      { rank: 2, playerId: '__robot__', nickname: '机器人', score: 3 },
    ],
    history: [],
  }))
  expect(await screen.findByText('恭喜你获得比赛胜利！')).toBeInTheDocument()
})

it('shows answerAck feedback on wrong answer', async () => {
  const socket = useSocket()
  renderBoard()
  await waitFor(() => emitSocketEvent(socket, 'game:question', { questionId: 'q1', expression: '12 + 34', round: 1 }))
  await waitFor(() => emitSocketEvent(socket, 'game:answerAck', {
    questionId: 'q1', correct: false, correctAnswer: 46, expression: '12 + 34', yourAnswer: 99,
  }))
  expect(await screen.findByText('❌ 错误')).toBeInTheDocument()
})

it('calls onFinish on game:cancelled', async () => {
  const socket = useSocket()
  const onFinish = vi.fn()
  render(<ArithmeticBoard gameInfo={GAME_INFO} onFinish={onFinish} />)
  await waitFor(() => emitSocketEvent(socket, 'game:cancelled', { message: '比赛已取消' }))
  expect(onFinish).toHaveBeenCalled()
})

it('does not submit when input is empty', async () => {
  const socket = useSocket()
  renderBoard()
  await waitFor(() => emitSocketEvent(socket, 'game:question', { questionId: 'q1', expression: '12 + 34', round: 1 }))
  fireEvent.click(screen.getByRole('button', { name: /提\s*交/ }))
  expect(socket.emit).not.toHaveBeenCalled()
})
