import { render, screen, fireEvent } from '@testing-library/react'
import ArithmeticMatchResult from '../components/ArithmeticMatchResult'

const RANKING = [
  { rank: 1, playerId: 's1', nickname: '小明', score: 5 },
  { rank: 2, playerId: '__robot__', nickname: '机器人', score: 3 },
]

const HISTORY = [
  {
    round: 1, questionId: 'q1', expression: '12 + 34', correctAnswer: 46,
    winner: 's1', answeredBy: { s1: 46, __robot__: 46 },
  },
  {
    round: 2, questionId: 'q2', expression: '50 - 20', correctAnswer: 30,
    winner: '__robot__', answeredBy: { s1: 30, __robot__: 30 },
  },
  {
    round: 3, questionId: 'q3', expression: '7 + 8', correctAnswer: 15,
    winner: 's1', answeredBy: { s1: 15 },
  },
]

function renderResult(props = {}) {
  return render(
    <ArithmeticMatchResult
      matchWinner="s1"
      scores={{ s1: 5, __robot__: 3 }}
      ranking={RANKING}
      history={HISTORY}
      myId="s1"
      onBack={vi.fn()}
      onRematch={vi.fn()}
      {...props}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('shows victory', () => {
  renderResult()
  expect(screen.getByText('恭喜你获得比赛胜利！')).toBeInTheDocument()
})

it('shows defeat when another player wins', () => {
  renderResult({ matchWinner: '__robot__', myId: 's1' })
  expect(screen.getByText(/机器人 获胜/)).toBeInTheDocument()
})

it('shows ranking', () => {
  renderResult()
  expect(screen.getByText('📊 最终排名')).toBeInTheDocument()
  expect(screen.getByText('小明')).toBeInTheDocument()
  expect(screen.getByText('机器人')).toBeInTheDocument()
})

it('shows 我 tag on current player', () => {
  renderResult()
  const cards = screen.getAllByText('我')
  expect(cards.length).toBeGreaterThanOrEqual(1)
})

it('shows history collapse', () => {
  renderResult()
  expect(screen.getByText('📝 对局回顾')).toBeInTheDocument()
  expect(screen.getByText(/12 \+ 34 = 46/)).toBeInTheDocument()
  expect(screen.getByText(/50 - 20 = 30/)).toBeInTheDocument()
})

it('shows un-answered player as — in expanded collapse', () => {
  renderResult()
  const header = screen.getByRole('button', { name: /7 \+ 8 = 15/ })
  fireEvent.click(header)
  const dashes = screen.getAllByText('—')
  expect(dashes.length).toBeGreaterThanOrEqual(1)
})

it('calls onBack when back button clicked', () => {
  const onBack = vi.fn()
  renderResult({ onBack })
  fireEvent.click(screen.getByText('返回房间'))
  expect(onBack).toHaveBeenCalled()
})

it('calls onRematch when rematch button clicked', () => {
  const onRematch = vi.fn()
  renderResult({ onRematch })
  fireEvent.click(screen.getByText('再来一局'))
  expect(onRematch).toHaveBeenCalled()
})

it('renders with empty history', () => {
  renderResult({ history: [] })
  expect(screen.queryByText('📝 对局回顾')).not.toBeInTheDocument()
})
