const mockReadFileSync = jest.fn()
const mockWriteFileSync = jest.fn()

jest.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}))

const CHAPTERS = ['1 Be good at school', '2 Please behave!', '3 Food we like']

function loadWordBank(saved = { enabledChapters: CHAPTERS, disabledWords: [] }) {
  jest.resetModules()
  mockReadFileSync.mockReturnValue(JSON.stringify(saved))
  mockWriteFileSync.mockClear()
  return require('../src/data/wordBank')
}

describe('wordBank 配置校验', () => {
  it('加载配置时过滤已不存在的章节和单词', () => {
    const wordBank = loadWordBank({
      enabledChapters: ['旧章节', CHAPTERS[0]],
      disabledWords: ['旧单词', 'classroom'],
    })

    expect(wordBank.getConfig()).toEqual({
      enabledChapters: [CHAPTERS[0]],
      disabledWords: ['classroom'],
    })
  })

  it('保存合法配置并去重', () => {
    const wordBank = loadWordBank()
    wordBank.setConfig({
      enabledChapters: [CHAPTERS[0], CHAPTERS[0]],
      disabledWords: ['classroom', 'classroom'],
    })

    expect(wordBank.getConfig()).toEqual({
      enabledChapters: [CHAPTERS[0]],
      disabledWords: ['classroom'],
    })
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1)
  })

  it.each([
    [null, '词库配置必须是对象'],
    [[], '词库配置必须是对象'],
    [{ enabledChapters: 'not-an-array' }, 'enabledChapters 必须是数组'],
    [{ disabledWords: 'not-an-array' }, 'disabledWords 必须是数组'],
    [{ enabledChapters: ['旧章节'] }, 'enabledChapters 包含不存在的章节'],
    [{ disabledWords: ['旧单词'] }, 'disabledWords 包含不在词库中的单词'],
    [{ enabledChapters: [] }, '至少需要保留一个可用的默写单词'],
  ])('拒绝非法配置 %p', (updates, message) => {
    const wordBank = loadWordBank()
    expect(() => wordBank.setConfig(updates)).toThrow(message)
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('拒绝禁用已启用章节中的全部单词', () => {
    const wordBank = loadWordBank()
    const chapter = wordBank.getChapters()[0]

    expect(() => wordBank.setConfig({
      enabledChapters: [chapter.chapter],
      disabledWords: chapter.words,
    })).toThrow('至少需要保留一个可用的默写单词')
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })
})
