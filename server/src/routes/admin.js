const roomManager = require('../socket/roomManager')
const gameManager = require('../socket/gameManager')
const unsplashClient = require('../unsplashClient')
const wordBank = require('../data/wordBank')
const config = require('../../config')

function ts() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

/**
 * 管理接口路由
 * @param {import('@koa/router')} router
 */
function registerAdminRoutes(router) {
  router.get('/api/admin/status', (ctx) => {
    ctx.body = {
      rooms: roomManager.getAdminStatus(),
      matchHistory: gameManager.getMatchHistory(),
    }
  })

  router.get('/api/admin/word-images/status', (ctx) => {
    const status = unsplashClient.getSyncStatus()
    ctx.body = {
      configured: !!config.unsplashAccessKey,
      syncing: unsplashClient.getSyncRunning(),
      ...status,
    }
  })

  router.post('/api/admin/word-images/sync', async (ctx) => {
    if (!config.unsplashAccessKey) {
      ctx.status = 400
      ctx.body = { error: 'UNSPLASH_ACCESS_KEY 未配置' }
      return
    }

    if (unsplashClient.getSyncRunning()) {
      ctx.status = 409
      ctx.body = { error: '同步正在进行中' }
      return
    }

    try {
      await unsplashClient.syncAll()
      const status = unsplashClient.getSyncStatus()
      ctx.body = {
        configured: true,
        syncing: false,
        ...status,
      }
    } catch (e) {
      ctx.status = 500
      ctx.body = { error: e.message }
    }
  })

  router.post('/api/admin/word-images/sync-missing', async (ctx) => {
    if (!config.unsplashAccessKey) {
      ctx.status = 400
      ctx.body = { error: 'UNSPLASH_ACCESS_KEY 未配置' }
      return
    }

    if (unsplashClient.getSyncRunning()) {
      ctx.status = 409
      ctx.body = { error: '同步正在进行中' }
      return
    }

    try {
      await unsplashClient.syncMissing()
      const status = unsplashClient.getSyncStatus()
      ctx.body = {
        configured: true,
        syncing: false,
        ...status,
      }
    } catch (e) {
      ctx.status = 500
      ctx.body = { error: e.message }
    }
  })

  router.get('/api/admin/word-config', (ctx) => {
    const chapters = wordBank.getChapters()
    const syncStatus = unsplashClient.getSyncStatus()
    const syncedMap = Object.fromEntries(
      syncStatus.words.map((w) => [w.word, w.status === 'synced'])
    )
    const configData = wordBank.getConfig()

    ctx.body = {
      chapters: chapters.map((c) => ({
        chapter: c.chapter,
        words: c.words.map((w) => ({
          word: w,
          synced: !!syncedMap[w],
        })),
      })),
      enabledChapters: configData.enabledChapters,
      disabledWords: configData.disabledWords,
    }
  })

  router.post('/api/admin/word-config', (ctx) => {
    try {
      wordBank.setConfig(ctx.request.body || {})
      ctx.body = { ok: true }
    } catch (error) {
      ctx.status = 400
      ctx.body = { error: error.message }
    }
  })

  router.post('/api/admin/word-images/replace/:word', async (ctx) => {
    if (!config.unsplashAccessKey) {
      ctx.status = 400
      ctx.body = { error: 'UNSPLASH_ACCESS_KEY 未配置' }
      return
    }

    const { word } = ctx.params
    if (!wordBank.getAllWords().includes(word)) {
      ctx.status = 400
      ctx.body = { error: `"${word}" 不在词库中` }
      return
    }

    console.log(`[${ts()}] [replace] ${word} — 开始换图`)
    try {
      await unsplashClient.syncWord(word)
      console.log(`[${ts()}] [replace] ${word} — 完成`)
      ctx.body = { word, imageUrl: unsplashClient.getImageUrl(word) || null }
    } catch (e) {
      ctx.status = 500
      ctx.body = { error: e.message }
    }
  })

  router.get('/api/admin/word-images/candidates/:word', async (ctx) => {
    const { word } = ctx.params
    if (!wordBank.getAllWords().includes(word)) {
      ctx.status = 400
      ctx.body = { error: `"${word}" 不在词库中` }
      return
    }
    const page = parseInt(ctx.query.page) || 1
    const perPage = parseInt(ctx.query.perPage) || 15
    try {
      const result = await unsplashClient.searchCandidates(word, page, perPage)
      ctx.body = { word, ...result }
    } catch (e) {
      ctx.status = 500
      ctx.body = { error: e.message }
    }
  })

  router.post('/api/admin/word-images/confirm/:word', async (ctx) => {
    const { word } = ctx.params
    const { imageUrl } = ctx.request.body || {}
    if (!imageUrl) {
      ctx.status = 400
      ctx.body = { error: '缺少 imageUrl' }
      return
    }
    try {
      const saved = await unsplashClient.downloadImage(imageUrl, word)
      if (!saved) {
        ctx.status = 500
        ctx.body = { error: '图片下载失败' }
        return
      }
      ctx.body = { word, imageUrl: unsplashClient.getImageUrl(word) }
    } catch (e) {
      ctx.status = 500
      ctx.body = { error: e.message }
    }
  })
}

module.exports = registerAdminRoutes
