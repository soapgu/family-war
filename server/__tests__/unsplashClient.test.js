jest.mock('../src/data/wordBank', () => ({
  getAllWords: jest.fn(() => ['cat', 'dog', 'elephant']),
  getActiveWords: jest.fn(() => ['cat', 'dog', 'elephant']),
  getChapters: jest.fn(() => [{ chapter: 'Test', words: ['cat', 'dog', 'elephant'] }]),
  getConfig: jest.fn(() => ({ enabledChapters: ['Test'], disabledWords: [] })),
  getWordSearchContext: jest.fn(() => ''),
}))

jest.mock('unsplash-js', () => ({
  default: jest.fn(),
}))

const Unsplash = require('unsplash-js').default

beforeEach(() => {
  jest.clearAllMocks()
})

// ==================== 无 API Key ====================

describe('无 API Key', () => {
  let fs

  beforeEach(() => {
    jest.resetModules()
    jest.doMock('fs', () => ({
      existsSync: jest.fn(() => false),
      readdirSync: jest.fn(() => []),
      writeFileSync: jest.fn(),
      mkdirSync: jest.fn(),
      statSync: jest.fn(() => ({ size: 100 })),
    }))
    jest.doMock('../config', () => ({ unsplashAccessKey: '' }))
  })

  it('syncAll 抛出错误', async () => {
    const client = require('../src/unsplashClient')
    await expect(client.syncAll()).rejects.toThrow('UNSPLASH_ACCESS_KEY 未配置')
  })

  it('getImageUrl 文件不存在返回空字符串', () => {
    const client = require('../src/unsplashClient')
    expect(client.getImageUrl('cat')).toBe('')
  })

  it('getImageUrl 文件存在返回 URL', () => {
    fs = require('fs')
    fs.existsSync.mockReturnValue(true)
    const client = require('../src/unsplashClient')
    expect(client.getImageUrl('cat')).toBe('/api/images/cat.jpg')
  })

  it('getSyncStatus 全部 pending', () => {
    const client = require('../src/unsplashClient')
    const status = client.getSyncStatus()
    expect(status.total).toBe(3)
    expect(status.synced).toBe(0)
    expect(status.pending).toBe(3)
    expect(status.words).toHaveLength(3)
    status.words.forEach((w) => {
      expect(w.status).toBe('pending')
      expect(w.url).toBeNull()
    })
  })

  it('getSyncStatus 部分同步', () => {
    fs = require('fs')
    fs.readdirSync.mockReturnValue(['cat.jpg', 'dog.jpg'])
    const client = require('../src/unsplashClient')
    const status = client.getSyncStatus()
    expect(status.total).toBe(3)
    expect(status.synced).toBe(2)
    expect(status.pending).toBe(1)
  })
})

// ==================== 有 API Key ====================

describe('有 API Key', () => {
  let client
  let fs
  let mockSearchPhotos

  beforeEach(() => {
    jest.resetModules()
    jest.doMock('fs', () => ({
      existsSync: jest.fn(() => false),
      readdirSync: jest.fn(() => []),
      writeFileSync: jest.fn(),
      mkdirSync: jest.fn(),
      statSync: jest.fn(() => ({ size: 100 })),
    }))

    mockSearchPhotos = jest.fn()

    jest.doMock('../config', () => ({ unsplashAccessKey: 'test-key' }))
    jest.doMock('unsplash-js', () => ({
      default: jest.fn(() => ({
        search: { photos: mockSearchPhotos },
      })),
    }))

    client = require('../src/unsplashClient')
    fs = require('fs')
  })

  describe('syncAll', () => {
    it('全部单词同步成功', async () => {
      mockSearchPhotos.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          results: [{ urls: { small: 'https://unsplash.com/test' } }],
        }),
      })

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      })

      await client.syncAll()

      expect(mockSearchPhotos).toHaveBeenCalledTimes(3)
      expect(mockSearchPhotos).toHaveBeenCalledWith('cat', 1, 5, { orientation: 'squarish' })
      expect(mockSearchPhotos).toHaveBeenCalledWith('dog', 1, 5, { orientation: 'squarish' })
      expect(mockSearchPhotos).toHaveBeenCalledWith('elephant', 1, 5, { orientation: 'squarish' })

      expect(fs.writeFileSync).toHaveBeenCalledTimes(3)
      expect(fs.statSync).toHaveBeenCalledTimes(3)

      delete global.fetch
    })

    it('搜索无结果时不下载', async () => {
      mockSearchPhotos.mockResolvedValue({
        json: jest.fn().mockResolvedValue({ results: [] }),
      })

      await client.syncAll()

      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it('图片下载失败时标记失败', async () => {
      mockSearchPhotos.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          results: [{ urls: { small: 'https://unsplash.com/test' } }],
        }),
      })

      global.fetch = jest.fn().mockResolvedValue({ ok: false })

      await client.syncAll()

      expect(fs.writeFileSync).not.toHaveBeenCalled()

      delete global.fetch
    })

    it('并行调用同步抛出错误', async () => {
      mockSearchPhotos.mockResolvedValue(new Promise(() => {}))
      global.fetch = jest.fn()

      client.syncAll()
      await expect(client.syncAll()).rejects.toThrow('同步正在进行中')

      delete global.fetch
    })

    it('同步完成后可再次调用', async () => {
      mockSearchPhotos.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          results: [{ urls: { small: 'https://unsplash.com/test' } }],
        }),
      })

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      })

      await client.syncAll()
      await client.syncAll()

      expect(fs.writeFileSync).toHaveBeenCalledTimes(6)

      delete global.fetch
    })

    it('同步失败后 _syncing 重置可再次调用', async () => {
      mockSearchPhotos.mockResolvedValue({
        json: jest.fn().mockResolvedValue({ results: [] }),
      })

      await client.syncAll()
      await expect(client.syncAll()).resolves.toBeUndefined()
    })

    it('getSyncRunning 返回正确状态', async () => {
      mockSearchPhotos.mockResolvedValue(new Promise(() => {}))
      global.fetch = jest.fn()

      client.syncAll()
      expect(client.getSyncRunning()).toBe(true)

      delete global.fetch
    })

    describe('syncMissing', () => {
      it('文件存在时跳过搜索和下载', async () => {
        fs.readdirSync.mockReturnValue(['cat.jpg', 'dog.jpg', 'elephant.jpg'])

        await client.syncMissing()

        expect(mockSearchPhotos).not.toHaveBeenCalled()
      })

      it('文件缺失时搜索并下载', async () => {
        fs.readdirSync.mockReturnValue(['dog.jpg', 'elephant.jpg'])

        mockSearchPhotos.mockResolvedValue({
          json: jest.fn().mockResolvedValue({
            results: [{ urls: { small: 'https://unsplash.com/test' } }],
          }),
        })

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
        })

        await client.syncMissing()

        expect(mockSearchPhotos).toHaveBeenCalledTimes(1)
        expect(mockSearchPhotos).toHaveBeenCalledWith('cat', 1, 5, { orientation: 'squarish' })
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1)

        delete global.fetch
      })

      it('全部已同步时返回空结果', async () => {
        fs.readdirSync.mockReturnValue(['cat.jpg', 'dog.jpg', 'elephant.jpg'])
        const onProgress = jest.fn()

        await client.syncMissing(onProgress)

        expect(onProgress).not.toHaveBeenCalled()
      })
    })

    describe('syncWord', () => {
      it('单个单词搜索并下载', async () => {
        mockSearchPhotos.mockResolvedValue({
          json: jest.fn().mockResolvedValue({
            results: [{ urls: { small: 'https://unsplash.com/test' } }],
          }),
        })

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
        })

        await client.syncWord('cat')

        expect(mockSearchPhotos).toHaveBeenCalledTimes(1)
        expect(mockSearchPhotos).toHaveBeenCalledWith('cat', 1, 5, { orientation: 'squarish' })
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1)

        delete global.fetch
      })

      it('不存在词库中的单词报错', async () => {
        await expect(client.syncWord('nonexistent')).rejects.toThrow('不在词库中')
      })

      it('onProgress 返回单个结果', async () => {
        mockSearchPhotos.mockResolvedValue({
          json: jest.fn().mockResolvedValue({
            results: [{ urls: { small: 'https://unsplash.com/test' } }],
          }),
        })

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
        })

        const onProgress = jest.fn()
        await client.syncWord('dog', onProgress)

        expect(onProgress).toHaveBeenCalledTimes(1)
        expect(onProgress).toHaveBeenCalledWith({ word: 'dog', status: 'synced' })

        delete global.fetch
      })

      it('防并行覆盖所有同步方法', async () => {
        mockSearchPhotos.mockResolvedValue(new Promise(() => {}))
        global.fetch = jest.fn()

        client.syncAll()
        await expect(client.syncMissing()).rejects.toThrow('同步正在进行中')
        await expect(client.syncWord('cat')).rejects.toThrow('同步正在进行中')

        delete global.fetch
      })
    })

    it('onProgress 回调接收每个单词状态', async () => {
      mockSearchPhotos.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          results: [{ urls: { small: 'https://unsplash.com/test' } }],
        }),
      })

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      })

      const onProgress = jest.fn()
      await client.syncAll(onProgress)

      expect(onProgress).toHaveBeenCalledTimes(3)
      expect(onProgress).toHaveBeenCalledWith({ word: 'cat', status: 'synced' })
      expect(onProgress).toHaveBeenCalledWith({ word: 'dog', status: 'synced' })
      expect(onProgress).toHaveBeenCalledWith({ word: 'elephant', status: 'synced' })

      delete global.fetch
    })
  })

  describe('getSyncStatus', () => {
    it('readdirSync 控制状态', async () => {
      fs.readdirSync.mockReturnValue(['cat.jpg', 'dog.jpg', 'elephant.jpg'])
      const status = client.getSyncStatus()
      expect(status.synced).toBe(3)
      status.words.forEach((w) => {
        expect(w.status).toBe('synced')
        expect(w.url).toBe(`/api/images/${w.word}.jpg`)
      })
    })
  })
})
