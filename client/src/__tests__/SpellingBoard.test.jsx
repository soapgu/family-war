import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import useSocket from '../hooks/useSocket'
import SpellingBoard from '../components/SpellingBoard'

vi.mock('../hooks/useSocket')

function emitSocketEvent(socket, event, data) {
  const callback = socket.on.mock.calls.find(([name]) => name === event)?.[1]
  act(() => callback?.(data))
}

const PLAYERS = [
  { id: 'test-socket-id', nickname: '小明', role: '爸爸' },
  { id: '__robot__', nickname: '机器人', role: '机器人' },
]

const FIRST_QUESTION = {
  questionId: 'q1',
  ttsText: 'art room',
  wordLength: 8,
  blanks: 'a _ _ · r _ _ m',
  unsplashImageUrl: '/api/images/art%20room.jpg',
  round: 1,
}

const GAME_INFO = {
  gameType: 'spelling',
  players: PLAYERS,
  difficulty: 'normal',
  firstQuestion: FIRST_QUESTION,
}

beforeEach(() => {
  vi.clearAllMocks()
  const speechSynthesis = {
    getVoices: vi.fn(() => [{ name: 'Daniel', lang: 'en-GB' }]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    cancel: vi.fn(),
    resume: vi.fn(),
    speak: vi.fn(),
  }
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speechSynthesis })
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    constructor(text) { this.text = text }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderBoard(props = {}) {
  return render(<SpellingBoard gameInfo={GAME_INFO} onFinish={vi.fn()} {...props} />)
}

it('渲染首题、难度、图片和填空字母格', () => {
  renderBoard()
  expect(screen.getByText('🔤 爱拼才会赢')).toBeInTheDocument()
  expect(screen.getByText('普通')).toBeInTheDocument()
  expect(screen.getByText('第 1 题')).toBeInTheDocument()
  expect(screen.getByAltText('单词提示图')).toHaveAttribute('src', '/api/images/art%20room.jpg')
  expect(screen.getByLabelText(/填空 a _ _/)).toBeInTheDocument()
  expect(screen.getAllByRole('textbox')).toHaveLength(4)
})

it('StrictMode 下首题倒计时正常更新', () => {
  vi.useFakeTimers()
  try {
    render(
      <StrictMode>
        <SpellingBoard gameInfo={GAME_INFO} onFinish={vi.fn()} />
      </StrictMode>
    )
    expect(screen.getByText(/30s/)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText(/29s/)).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

it('首题自动使用英式英语朗读并支持重播', async () => {
  render(
    <StrictMode>
      <SpellingBoard gameInfo={GAME_INFO} onFinish={vi.fn()} />
    </StrictMode>
  )
  await waitFor(() => expect(window.speechSynthesis.speak).toHaveBeenCalled())
  const firstUtterance = window.speechSynthesis.speak.mock.calls[0][0]
  expect(firstUtterance.text).toBe('art room')
  expect(firstUtterance.lang).toBe('en-GB')
  expect(firstUtterance.rate).toBe(0.8)

  fireEvent.click(screen.getByRole('button', { name: /再听一次/ }))
  await waitFor(() => expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2))
})

it('首题默认自动朗读 3 遍且中间有停顿', async () => {
  vi.useFakeTimers()
  try {
    renderBoard()
    act(() => vi.advanceTimersByTime(50))
    expect(window.speechSynthesis.speak).toHaveBeenCalledOnce()

    act(() => window.speechSynthesis.speak.mock.calls[0][0].onend())
    act(() => vi.advanceTimersByTime(449))
    expect(window.speechSynthesis.speak).toHaveBeenCalledOnce()

    act(() => vi.advanceTimersByTime(1))
    act(() => vi.advanceTimersByTime(50))
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2)

    act(() => window.speechSynthesis.speak.mock.calls[1][0].onend())
    act(() => vi.advanceTimersByTime(450))
    act(() => vi.advanceTimersByTime(50))
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(3)

    act(() => window.speechSynthesis.speak.mock.calls[2][0].onend())
    act(() => vi.advanceTimersByTime(1000))
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(3)
  } finally {
    vi.useRealTimers()
  }
})

it('首题等待异步语音列表加载后再使用英式音色朗读', async () => {
  const synth = window.speechSynthesis
  synth.getVoices.mockReturnValue([])
  renderBoard()

  expect(synth.speak).not.toHaveBeenCalled()
  const onVoicesChanged = synth.addEventListener.mock.calls.find(([event]) => event === 'voiceschanged')[1]
  synth.getVoices.mockReturnValue([{ name: 'Daniel', lang: 'en-GB' }])
  act(() => onVoicesChanged())

  await waitFor(() => expect(synth.speak).toHaveBeenCalledOnce())
  const utterance = synth.speak.mock.calls[0][0]
  expect(utterance.text).toBe('art room')
  expect(utterance.voice).toEqual({ name: 'Daniel', lang: 'en-GB' })
})

it('开始后自动聚焦第一个空格', () => {
  vi.useFakeTimers()
  try {
    renderBoard()
    act(() => vi.advanceTimersByTime(100))
    expect(screen.getByLabelText('第 1 个空格')).toHaveFocus()
  } finally {
    vi.useRealTimers()
  }
})

it('逐格输入英文字母并在填满后自动提交完整答案', () => {
  const socket = useSocket()
  renderBoard()
  fireEvent.change(screen.getByLabelText('第 1 个空格'), { target: { value: 'r' } })
  expect(socket.emit).not.toHaveBeenCalledWith('game:answer', expect.anything())
  fireEvent.change(screen.getByLabelText('第 2 个空格'), { target: { value: 't' } })
  fireEvent.change(screen.getByLabelText('第 3 个空格'), { target: { value: 'o' } })
  fireEvent.change(screen.getByLabelText('第 4 个空格'), { target: { value: 'o' } })
  expect(socket.emit).toHaveBeenCalledWith('game:answer', { questionId: 'q1', answer: 'art room' })
})

it('输入一个字母后自动跳到下一个空格', () => {
  vi.useFakeTimers()
  try {
    renderBoard()
    fireEvent.change(screen.getByLabelText('第 1 个空格'), { target: { value: 'r' } })
    act(() => vi.advanceTimersByTime(0))
    expect(screen.getByLabelText('第 2 个空格')).toHaveFocus()
  } finally {
    vi.useRealTimers()
  }
})

it('非法输入会清除并停留在当前空格', () => {
  const socket = useSocket()
  renderBoard()
  const firstBlank = screen.getByLabelText('第 1 个空格')
  fireEvent.change(firstBlank, { target: { value: '1' } })
  expect(firstBlank).toHaveValue('')
  expect(socket.emit).not.toHaveBeenCalledWith('game:answer', expect.anything())
})

it('答错后展示正确答案并锁定本题', async () => {
  const socket = useSocket()
  renderBoard()
  await waitFor(() => emitSocketEvent(socket, 'game:answerAck', {
    questionId: 'q1',
    correct: false,
    correctAnswer: 'art room',
    word: 'art room',
    yourAnswer: 'artroom',
  }))
  expect(screen.queryByText('❌ 本题未答对')).not.toBeInTheDocument()
  expect(screen.queryByText(/正确答案：art room/)).not.toBeInTheDocument()
  screen.getAllByRole('textbox').forEach((input) => {
    expect(input).toBeDisabled()
  })
})

it('轮结果更新排行榜和正确反馈', async () => {
  const socket = useSocket()
  renderBoard()
  await waitFor(() => emitSocketEvent(socket, 'game:roundResult', {
    gameType: 'spelling',
    round: 1,
    questionId: 'q1',
    word: 'art room',
    correctAnswer: 'art room',
    yourAnswer: 'ART ROOM',
    winner: 'test-socket-id',
    scores: { 'test-socket-id': 1, __robot__: 0 },
  }))
  expect(screen.queryByText('✅ 拼写正确！')).not.toBeInTheDocument()
  expect(screen.getByText('1分')).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it('后续题清理旧反馈并自动朗读', async () => {
  const socket = useSocket()
  renderBoard()
  emitSocketEvent(socket, 'game:answerAck', {
    questionId: 'q1', correct: false, correctAnswer: 'art room', yourAnswer: 'wrong',
  })
  const nextQuestion = {
    questionId: 'q2', ttsText: 'library', wordLength: 7,
    blanks: '_ i _ _ a _ _', unsplashImageUrl: '', round: 2,
  }
  emitSocketEvent(socket, 'game:question', nextQuestion)

  expect(await screen.findByText('第 2 题')).toBeInTheDocument()
  screen.getAllByRole('textbox').forEach((input) => {
    expect(input).toBeEnabled()
  })
  await waitFor(() => {
    expect(window.speechSynthesis.speak.mock.calls.at(-1)[0].text).toBe('library')
  })
})

it('重赛 game:start 重置比分、难度和题目', async () => {
  const socket = useSocket()
  renderBoard()
  emitSocketEvent(socket, 'game:roundResult', {
    gameType: 'spelling', questionId: 'q1', correctAnswer: 'art room',
    winner: 'test-socket-id', scores: { 'test-socket-id': 1, __robot__: 0 },
  })
  emitSocketEvent(socket, 'game:start', {
    gameType: 'spelling', players: PLAYERS, difficulty: 'hard',
    firstQuestion: { ...FIRST_QUESTION, questionId: 'q-new', round: 1, ttsText: 'classroom' },
  })

  expect(await screen.findByText('困难')).toBeInTheDocument()
  expect(screen.getAllByText('0分')).toHaveLength(2)
  expect(screen.getByText('第 1 题')).toBeInTheDocument()
})

it('比赛结束后 spelling 重赛使用 game:challenge', async () => {
  const socket = useSocket()
  renderBoard()
  emitSocketEvent(socket, 'game:matchResult', {
    gameType: 'spelling',
    matchWinner: 'test-socket-id',
    scores: { 'test-socket-id': 5, __robot__: 2 },
    ranking: [
      { rank: 1, playerId: 'test-socket-id', nickname: '小明', score: 5 },
      { rank: 2, playerId: '__robot__', nickname: '机器人', score: 2 },
    ],
    history: [],
  })

  fireEvent.click(await screen.findByRole('button', { name: '再来一局' }))
  expect(socket.emit).toHaveBeenCalledWith('game:challenge', { mode: 'spelling' })
})

it('收到取消事件后退出面板', async () => {
  const socket = useSocket()
  const onFinish = vi.fn()
  renderBoard({ onFinish })
  await waitFor(() => emitSocketEvent(socket, 'game:cancelled', { message: '比赛取消' }))
  expect(onFinish).toHaveBeenCalled()
})

it('卸载时关闭反馈音效上下文', () => {
  const socket = useSocket()
  const closeSpy = vi.spyOn(window.AudioContext.prototype, 'close')
  const { unmount } = renderBoard()
  emitSocketEvent(socket, 'game:answerAck', {
    questionId: 'q1', correct: false, correctAnswer: 'art room', yourAnswer: 'wrong',
  })

  unmount()
  expect(closeSpy).toHaveBeenCalledOnce()
})
