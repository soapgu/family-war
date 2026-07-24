import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App as AntApp } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { AdminAuthProvider } from '../auth/AdminAuthContext'
import WordConfigPage from '../modules/family-war/WordConfigPage'

const WORD_CONFIG = {
  chapters: [{
    chapter: '第一章',
    words: [
      { word: 'classroom', synced: false },
      { word: 'library', synced: true },
    ],
  }],
  enabledChapters: ['第一章'],
  disabledWords: [],
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  }
}

function renderPage(config = WORD_CONFIG) {
  fetch.mockResolvedValueOnce(response(config))
  return render(
    <MemoryRouter>
      <AntApp>
        <AdminAuthProvider logout={vi.fn()}>
          <WordConfigPage />
        </AdminAuthProvider>
      </AntApp>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: vi.fn(() => []),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      resume: vi.fn(),
      speak: vi.fn(),
    },
  })
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    constructor(text) { this.text = text }
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('WordConfigPage', () => {
  it('加载词库并通过 family-war API 保存合法修改', async () => {
    renderPage()
    await screen.findByText('classroom')
    fetch.mockResolvedValueOnce(response({ ok: true }))

    fireEvent.click(screen.getAllByRole('switch')[1])
    expect(screen.getByText('有未保存的修改')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/admin/word-config',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          enabledChapters: ['第一章'],
          disabledWords: ['classroom'],
        }),
      }),
    )
    expect(await screen.findByText('配置已保存')).toBeInTheDocument()
  })

  it('阻止关闭最后一个可用章节或单词', async () => {
    renderPage({
      ...WORD_CONFIG,
      chapters: [{
        chapter: '第一章',
        words: [{ word: 'classroom', synced: false }],
      }],
    })
    await screen.findByText('classroom')

    fireEvent.click(screen.getAllByRole('switch')[0])
    expect(await screen.findByText('至少需要保留一个可用的默写单词')).toBeInTheDocument()
    expect(screen.getAllByRole('switch')[0]).toBeChecked()

    fireEvent.click(screen.getAllByRole('switch')[1])
    expect(screen.getAllByRole('switch')[1]).toBeChecked()
  })

  it('同步缺失图片后保留未保存的本地选择', async () => {
    renderPage()
    await screen.findByText('classroom')
    fireEvent.click(screen.getAllByRole('switch')[1])
    fetch.mockResolvedValueOnce(response({
      words: [
        { word: 'classroom', status: 'synced' },
        { word: 'library', status: 'synced' },
      ],
    }))

    fireEvent.click(screen.getByRole('button', { name: '同步缺失 1 个' }))

    expect(await screen.findByText('所有图片均已就绪')).toBeInTheDocument()
    expect(screen.getByText('有未保存的修改')).toBeInTheDocument()
    expect(screen.getAllByRole('switch')[1]).not.toBeChecked()
  })

  it('选择候选图片并确认换图', async () => {
    renderPage()
    await screen.findByText('classroom')
    fetch.mockResolvedValueOnce(response({
      candidates: [{
        id: 'photo-1',
        candidateId: 'candidate-uuid-1',
        thumb: 'https://example.com/thumb.jpg',
        alt: '候选教室图片',
        author: 'Tester',
      }],
      total: 1,
      page: 1,
    }))

    fireEvent.click(screen.getByRole('button', { name: '更换 classroom 图片' }))
    fireEvent.click(await screen.findByAltText('候选教室图片'))
    fetch.mockResolvedValueOnce(response({ ok: true }))
    fireEvent.click(screen.getByRole('button', { name: '确认换图' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/admin/word-images/confirm/classroom',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ candidateId: 'candidate-uuid-1' }),
      }),
    )
  })

  it('重置语音队列后延迟播放英式发音', async () => {
    renderPage()
    await screen.findByText('classroom')
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: '播放 classroom' }))
    expect(window.speechSynthesis.cancel).toHaveBeenCalled()
    expect(window.speechSynthesis.resume).toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(50))
    const utterance = window.speechSynthesis.speak.mock.calls[0][0]
    expect(utterance.text).toBe('classroom')
    expect(utterance.lang).toBe('en-GB')
    expect(utterance.rate).toBe(0.8)
  })
})
