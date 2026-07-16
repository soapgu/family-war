import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      speak: vi.fn(),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WordConfig', () => {
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
    renderWordConfig()
    await screen.findByText('第一章')
    fetch.mockResolvedValueOnce(response({ ok: true }))

    fireEvent.click(screen.getByRole('button', { name: '保存配置' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch.mock.calls[1][0]).toBe('/api/admin/word-config')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      enabledChapters: ['第一章'],
      disabledWords: [],
    })
  })

  it('展示后端返回的保存错误', async () => {
    renderWordConfig()
    await screen.findByText('第一章')
    fetch.mockResolvedValueOnce(response({ error: '配置校验失败' }, false))

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
})
