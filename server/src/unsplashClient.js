const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const logger = require('./logger')
const config = require('../config')
const wordBank = require('./data/wordBank')
const words = wordBank.getAllWords()
const Unsplash = require('unsplash-js').default

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images')
const CANDIDATE_TTL_MS = 10 * 60 * 1000
const CANDIDATE_CLEANUP_MS = 5 * 60 * 1000

class UnsplashClient {
  constructor() {
    this.api = null
    this._syncing = false
    this._candidateCache = new Map()
    this._cleanupTimer = setInterval(() => this._cleanupCandidates(), CANDIDATE_CLEANUP_MS)
    this._init()
  }

  _init() {
    fs.mkdirSync(IMAGES_DIR, { recursive: true })

    if (config.unsplashAccessKey) {
      this.api = new Unsplash({ accessKey: config.unsplashAccessKey })
    }
  }

  _cleanupCandidates() {
    const now = Date.now()
    for (const [word, wordCache] of this._candidateCache) {
      for (const [candidateId, entry] of wordCache) {
        if (now - entry.createdAt > CANDIDATE_TTL_MS) {
          wordCache.delete(candidateId)
        }
      }
      if (wordCache.size === 0) {
        this._candidateCache.delete(word)
      }
    }
  }

  consumeCandidate(word, candidateId) {
    const wordCache = this._candidateCache.get(word)
    if (!wordCache) return null
    const entry = wordCache.get(candidateId)
    if (!entry) return null
    wordCache.delete(candidateId)
    if (wordCache.size === 0) this._candidateCache.delete(word)
    return entry.url
  }

  _filePath(word) {
    return path.join(IMAGES_DIR, `${word}.jpg`)
  }

  getImageUrl(word) {
    return fs.existsSync(this._filePath(word)) ? `/api/images/${encodeURIComponent(word)}` : ''
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
        url: exists ? `/api/images/${encodeURIComponent(w)}` : null,
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

  async _searchPhotos(word, perPage, page = 1) {
    const context = wordBank.getWordSearchContext(word)
    const queries = [word]
    if (context) queries.push(`${word} ${context}`)
    const first = word.split(' ')[0]
    if (first !== word) queries.push(first)

    for (const q of queries) {
      const result = await this.api.search.photos(q, page, perPage, {
        orientation: 'squarish',
      })
      const data = await result.json()
      if (data.results?.length) {
        logger.info(`[unsplash] ${word} (查询: "${q}") — 搜到 ${data.results.length} 张`)
        return { results: data.results, total: data.total }
      }
      logger.info(`[unsplash] ${word} (查询: "${q}") — 0 结果，继续下一个查询`)
    }
    logger.warn(`[unsplash] ${word} — 所有查询均无结果`)
    return { results: [], total: 0 }
  }

  async _searchImageUrl(word) {
    const { results: photos } = await this._searchPhotos(word, config.unsplashPerPage)
    if (!photos.length) return ''
    const idx = Math.floor(Math.random() * photos.length)
    logger.info(`[unsplash] ${word} — 随机选第 ${idx + 1}/${photos.length} 张`)
    return photos[idx].urls.small || ''
  }

  async searchCandidates(word, page = 1, perPage = 15) {
    if (!this.api) {
      throw new Error('UNSPLASH_ACCESS_KEY 未配置')
    }
    const { results, total } = await this._searchPhotos(word, perPage, page)

    if (!this._candidateCache.has(word)) {
      this._candidateCache.set(word, new Map())
    }
    const wordCache = this._candidateCache.get(word)

    const candidates = results.map(p => {
      const candidateId = crypto.randomUUID()
      wordCache.set(candidateId, {
        url: p.urls.small,
        thumb: p.urls.thumb,
        author: p.user.name,
        alt: p.alt_description || '',
        createdAt: Date.now(),
      })
      return {
        id: p.id,
        candidateId,
        thumb: p.urls.thumb,
        author: p.user.name,
        alt: p.alt_description || '',
      }
    })

    return { candidates, total, page, perPage }
  }

  async _downloadImage(imageUrl, word) {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) return false

    const buffer = Buffer.from(await response.arrayBuffer())
    fs.writeFileSync(this._filePath(word), buffer)
    return fs.statSync(this._filePath(word)).size > 0
  }

  async downloadImage(imageUrl, word) {
    return this._downloadImage(imageUrl, word)
  }
}

module.exports = new UnsplashClient()
