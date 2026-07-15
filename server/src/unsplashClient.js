const fs = require('fs')
const path = require('path')
const config = require('../config')
const wordBank = require('./data/wordBank')
const words = wordBank.getAllWords()
const Unsplash = require('unsplash-js').default

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images')

class UnsplashClient {
  constructor() {
    this.api = null
    this._syncing = false
    this._init()
  }

  _init() {
    fs.mkdirSync(IMAGES_DIR, { recursive: true })

    if (config.unsplashAccessKey) {
      this.api = new Unsplash({ accessKey: config.unsplashAccessKey })
    }
  }

  _filePath(word) {
    return path.join(IMAGES_DIR, `${word}.jpg`)
  }

  getImageUrl(word) {
    return fs.existsSync(this._filePath(word)) ? `/api/images/${word}.jpg` : ''
  }

  getSyncRunning() {
    return this._syncing
  }

  _syncedSet() {
    try {
      return new Set(fs.readdirSync(IMAGES_DIR).map((f) => path.basename(f, '.jpg')))
    } catch {
      return new Set()
    }
  }

  getSyncStatus() {
    const total = words.length
    const syncedSet = this._syncedSet()
    const wordList = words.map((w) => {
      const exists = syncedSet.has(w)
      return {
        word: w,
        url: exists ? `/api/images/${w}.jpg` : null,
        status: exists ? 'synced' : 'pending',
      }
    })
    const synced = wordList.filter((w) => w.status === 'synced').length
    return { total, synced, pending: total - synced, words: wordList }
  }

  async syncAll(onProgress) {
    return this._syncLoop(words, onProgress)
  }

  async syncMissing(onProgress) {
    const syncedSet = this._syncedSet()
    const missing = words.filter((w) => !syncedSet.has(w))
    return this._syncLoop(missing, onProgress)
  }

  async syncWord(word, onProgress) {
    if (!words.includes(word)) {
      throw new Error(`"${word}" 不在词库中`)
    }
    return this._syncLoop([word], onProgress)
  }

  async _syncLoop(wordList, onProgress) {
    if (!this.api) {
      throw new Error('UNSPLASH_ACCESS_KEY 未配置')
    }

    if (this._syncing) {
      throw new Error('同步正在进行中，请勿重复触发')
    }
    this._syncing = true
    try {
      for (const word of wordList) {
        try {
          const imageUrl = await this._searchImageUrl(word)
          if (!imageUrl) {
            throw new Error('未找到图片')
          }

          const saved = await this._downloadImage(imageUrl, word)
          if (!saved) {
            throw new Error('图片下载失败')
          }

          onProgress?.({ word, status: 'synced' })
        } catch (e) {
          onProgress?.({ word, status: 'failed', error: e.message })
        }
      }
    } finally {
      this._syncing = false
    }
  }

  async _searchImageUrl(word) {
    const result = await this.api.search.photos(word, 1, 5, {
      orientation: 'squarish',
    })
    const data = await result.json()
    const photos = data.results
    if (!photos?.length) return ''
    const pick = photos[Math.floor(Math.random() * photos.length)]
    return pick.urls.small || ''
  }

  async _downloadImage(imageUrl, word) {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) return false

    const buffer = Buffer.from(await response.arrayBuffer())
    fs.writeFileSync(this._filePath(word), buffer)
    return fs.statSync(this._filePath(word)).size > 0
  }
}

module.exports = new UnsplashClient()
