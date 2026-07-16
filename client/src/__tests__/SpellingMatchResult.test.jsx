import { render, screen, fireEvent } from '@testing-library/react'
import SpellingMatchResult from '../components/SpellingMatchResult'

const RANKING = [
  { rank: 1, playerId: 's1', nickname: '小明', score: 5 },
  { rank: 2, playerId: 's2', nickname: '小红', score: 1 },
  { rank: 3, playerId: '__robot__', nickname: '机器人', score: 0 },
]

const HISTORY = [
  {
    round: 1,
    questionId: 'q1',
    word: 'hello',
    blanks: 'h_ll_',
    winner: 's1',
    answeredBy: { s1: 'hello', s2: 'hallo' },
  },
  {
    round: 2,
    questionId: 'q2',
    word: 'ice cream',
    blanks: 'i__ · c____',
    winner: 's1',
    answeredBy: { s1: 'ICE CREAM' },
  },
]

function renderResult(props = {}) {
  return render(
    <SpellingMatchResult
      matchWinner="s1"
      ranking={RANKING}
      history={HISTORY}
      myId="s1"
      onBack={vi.fn()}
      onRematch={vi.fn()}
      {...props}
    />
  )
}

it('展示胜负文案和最终排名', () => {
  renderResult()
  expect(screen.getByText('恭喜你获得比赛胜利！')).toBeInTheDocument()
  expect(screen.getByText('📊 最终排名')).toBeInTheDocument()
  expect(screen.getByText('小红')).toBeInTheDocument()

  renderResult({ matchWinner: 's2', myId: 's1' })
  expect(screen.getByText('小红 获胜！')).toBeInTheDocument()
})

it('展示单词和词组回顾、填空提示及所有玩家答案', () => {
  renderResult()
  expect(screen.getByText('🔤 单词回顾')).toBeInTheDocument()
  expect(screen.getByText('hello')).toBeInTheDocument()
  expect(screen.getByText('ice cream')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /ice cream/ }))
  expect(screen.getByText('填空提示：i__ · c____')).toBeInTheDocument()
  expect(screen.getByText(/✅ ICE CREAM/)).toBeInTheDocument()
  expect(screen.getAllByText('未作答')).toHaveLength(2)
})

it('展示错误答案并调用操作按钮', () => {
  const onBack = vi.fn()
  const onRematch = vi.fn()
  renderResult({ onBack, onRematch })
  fireEvent.click(screen.getByRole('button', { name: /hello/ }))
  expect(screen.getByText(/❌ hallo/)).toBeInTheDocument()

  fireEvent.click(screen.getByText('返回房间'))
  fireEvent.click(screen.getByText('再来一局'))
  expect(onBack).toHaveBeenCalledOnce()
  expect(onRematch).toHaveBeenCalledOnce()
})
