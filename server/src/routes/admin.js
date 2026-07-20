const roomManager = require('../socket/roomManager')
const gameManager = require('../socket/gameManager')
const unsplashClient = require('../unsplashClient')
const wordBank = require('../data/wordBank')
const config = require('../../config')
const jwt = require('jsonwebtoken')
const { getJwtSecret } = require('../middleware/auth')

function ts() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

/**
 * 管理接口路由
 * @param {import('@koa/router')} router
 */
function registerAdminRoutes(router) {
  router.post('/api/admin/login', (ctx) => {
    const { password } = ctx.request.body || {}
    const { adminPassword } = config.auth

    if (adminPassword && password !== adminPassword) {
      console.log(`[${ts()}] [auth] login FAIL — wrong password`)
      ctx.status = 401
      ctx.body = { error: '密码错误' }
      return
    }

    const token = jwt.sign({ role: 'admin' }, getJwtSecret(), { expiresIn: '24h' })
    ctx.cookies.set('admin_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 86400000,
      path: '/',
    })
    console.log(`[${ts()}] [auth] login OK — token issued (adminPassword=${adminPassword ? 'set' : 'empty'})`)
    ctx.body = { success: true }
  })

  router.post('/api/admin/logout', (ctx) => {
    const hadCookie = !!ctx.cookies.get('admin_token')
    ctx.cookies.set('admin_token', null, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: -1,
      path: '/',
    })
    console.log(`[${ts()}] [auth] logout — cookie ${hadCookie ? 'cleared' : 'already empty'}, set-cookie: admin_token=; path=/; expires=Thu, 01 Jan 1970`)
    ctx.body = { success: true }
  })

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
    const page = Math.max(1, parseInt(ctx.query.page, 10) || 1)
    const perPage = Math.max(1, Math.min(30, parseInt(ctx.query.perPage, 10) || 15))
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
