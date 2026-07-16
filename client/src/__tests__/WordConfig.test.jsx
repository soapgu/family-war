import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App as AntApp } from 'antd'
import WordConfig from '../pages/WordConfig'

const ONE_WORD_CONFIG = {
  chapters: [{
    chapter: '第一章',
    words: [{ word: 'classroom', synced: false }],
  }],
  enabledChapters: ['第一章'],
  disabledWords: [],
}

const TWO_WORD_CONFIG = {
  ...ONE_WORD_CONFIG,
  chapters: [{
    chapter: '第一章',
    words: [
      { word: 'classroom', synced: false },
      { word: 'library', synced: true },
    ],
  }],
}

function response(body, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(body) }
}

function renderWordConfig(config = ONE_WORD_CONFIG) {
  fetch.mockResolvedValueOnce(response(config))
  return render(<AntApp><WordConfig /></AntApp>)
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

describe('WordConfig', () => {
  it('重置 Chrome 语音队列后延迟播放英式发音', async () => {
    renderWordConfig()
    await screen.findByText('classroom')
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: '播放 classroom' }))
    expect(window.speechSynthesis.cancel).toHaveBeenCalled()
    expect(window.speechSynthesis.resume).toHaveBeenCalled()
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(50))
    expect(window.speechSynthesis.speak).toHaveBeenCalledOnce()
    const utterance = window.speechSynthesis.speak.mock.calls[0][0]
    expect(utterance.text).toBe('classroom')
    expect(utterance.lang).toBe('en-GB')
    expect(utterance.rate).toBe(0.8)
  })

  it('阻止关闭最后一个启用章节', async () => {
    renderWordConfig()
    await screen.findByText('第一章')

    const chapterSwitch = screen.getAllByRole('switch')[0]
    fireEvent.click(chapterSwitch)

    expect(chapterSwitch).toBeChecked()
    expect(await screen.findByText('至少需要保留一个可用的默写单词')).toBeInTheDocument()
  })

  it('阻止禁用最后一个可用单词', async () => {
    renderWordConfig()
    await screen.findByText('classroom')

    const wordSwitch = screen.getAllByRole('switch')[1]
    fireEvent.click(wordSwitch)

    expect(wordSwitch).toBeChecked()
    expect(await screen.findByText('至少需要保留一个可用的默写单词')).toBeInTheDocument()
  })

  it('合法配置可以保存', async () => {
    renderWordConfig(TWO_WORD_CONFIG)
    await screen.findByText('第一章')
    fetch.mockResolvedValueOnce(response({ ok: true }))

    expect(screen.getByRole('button', { name: '保存配置' })).toBeDisabled()
    fireEvent.click(screen.getAllByRole('switch')[1])
    expect(screen.getByText('有未保存的修改')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch.mock.calls[1][0]).toBe('/api/admin/word-config')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      enabledChapters: ['第一章'],
      disabledWords: ['classroom'],
    })
    expect(await screen.findByText('配置已保存')).toBeInTheDocument()
  })

  it('展示后端返回的保存错误', async () => {
    renderWordConfig(TWO_WORD_CONFIG)
    await screen.findByText('第一章')
    fetch.mockResolvedValueOnce(response({ error: '配置校验失败' }, false))

    fireEvent.click(screen.getAllByRole('switch')[1])
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }))

    expect(await screen.findByText('配置校验失败')).toBeInTheDocument()
  })

  it('初始空配置显示警告并禁止保存', async () => {
    renderWordConfig({ ...ONE_WORD_CONFIG, enabledChapters: [] })
    await screen.findByText('第一章')

    expect(screen.getByLabelText('当前启用 0 个单词')).toBeInTheDocument()
    expect(screen.getByText('至少需要保留一个可用的默写单词')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存配置' })).toBeDisabled()
  })

  it('存在缺失图片时允许同步并显示缺失数量', async () => {
    renderWordConfig()
    await screen.findByText('第一章')

    expect(screen.getByRole('button', { name: '同步缺失 1 个' })).toBeEnabled()
    expect(screen.getByText('还差 1 张图片待同步')).toBeInTheDocument()
  })

  it('图片全部同步后禁用同步按钮', async () => {
    renderWordConfig({
      ...ONE_WORD_CONFIG,
      chapters: [{
        ...ONE_WORD_CONFIG.chapters[0],
        words: [{ word: 'classroom', synced: true }],
      }],
    })
    await screen.findByText('第一章')

    expect(screen.getByRole('button', { name: '已全部同步' })).toBeDisabled()
    expect(screen.getByText('所有图片均已就绪')).toBeInTheDocument()
  })

  it('未保存配置时同步图片不会覆盖本地选择', async () => {
    renderWordConfig(TWO_WORD_CONFIG)
    await screen.findByText('第一章')
    fireEvent.click(screen.getAllByRole('switch')[1])
    fetch.mockResolvedValueOnce(response({
      words: [
        { word: 'classroom', status: 'synced' },
        { word: 'library', status: 'synced' },
      ],
    }))

    const syncButton = screen.getByRole('button', { name: '同步缺失 1 个' })
    expect(syncButton).toBeEnabled()
    fireEvent.click(syncButton)

    expect(await screen.findByText('所有图片均已就绪')).toBeInTheDocument()
    expect(screen.getByText('有未保存的修改')).toBeInTheDocument()
    expect(screen.getAllByRole('switch')[1]).not.toBeChecked()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('未保存配置时仍可换图且不会覆盖本地选择', async () => {
    renderWordConfig(TWO_WORD_CONFIG)
    await screen.findByText('第一章')
    fireEvent.click(screen.getAllByRole('switch')[1])
    fetch.mockResolvedValueOnce(response({
      candidates: [{
        id: 'photo-1',
        url: 'https://example.com/full.jpg',
        thumb: 'https://example.com/thumb.jpg',
        alt: '候选教室图片',
        author: 'Tester',
      }],
      total: 1,
      page: 1,
    }))

    const replaceButton = screen.getByRole('button', { name: '更换 classroom 图片' })
    expect(replaceButton).toBeEnabled()
    fireEvent.click(replaceButton)
    fireEvent.click(await screen.findByAltText('候选教室图片'))
    fetch.mockResolvedValueOnce(response({ ok: true }))
    fireEvent.click(screen.getByRole('button', { name: '确认换图' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    expect(screen.getByText('有未保存的修改')).toBeInTheDocument()
    expect(screen.getAllByRole('switch')[1]).not.toBeChecked()
    expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled()
  })
})
