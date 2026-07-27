const roomManager = require('../socket/roomManager')
const gameManager = require('../socket/gameManager')
const unsplashClient = require('../unsplashClient')
const wordBank = require('../data/wordBank')
const config = require('../../config')
const logger = require('../logger')

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

    logger.info(`[replace] ${word} — 开始换图`)
    try {
      await unsplashClient.syncWord(word)
      logger.info(`[replace] ${word} — 完成`)
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
    if (!/^[\w\s-]+$/.test(word)) {
      ctx.status = 400
      ctx.body = { error: '无效的单词' }
      return
    }
    const rawPage = parseInt(ctx.query.page, 10)
    const rawPerPage = parseInt(ctx.query.perPage, 10)
    const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1)
    const perPage = Math.max(1, Math.min(30, Number.isFinite(rawPerPage) ? rawPerPage : 15))
    logger.info(`[candidates] ${word} — 请求, page=${page}, perPage=${perPage}`)
    try {
      const result = await unsplashClient.searchCandidates(word, page, perPage)
      ctx.body = { word, ...result }
      logger.info(`[candidates] ${word} — 成功, 返回 ${result.candidates.length} 张`)
    } catch (e) {
      ctx.status = 500
      ctx.body = { error: e.message }
      logger.error(
        `[candidates] ${word} — 接口失败: ${e.message}` +
        `${e.cause?.code ? `, code=${e.cause.code}` : ''}` +
        `${e.cause?.message ? `, cause=${e.cause.message}` : ''}`
      )
    }
  })

  router.post('/api/admin/word-images/confirm/:word', async (ctx) => {
    const { word } = ctx.params
    const { candidateId } = ctx.request.body || {}
    logger.info(`[confirm] ${word} — 请求, candidateId=${candidateId ? candidateId.slice(0, 8) + '...' : '无'}`)
    if (!candidateId) {
      ctx.status = 400
      ctx.body = { error: '缺少 candidateId' }
      logger.warn(`[confirm] ${word} — 缺少 candidateId`)
      return
    }
    if (!wordBank.getAllWords().includes(word)) {
      ctx.status = 400
      ctx.body = { error: `"${word}" 不在词库中` }
      logger.warn(`[confirm] ${word} — 不在词库中`)
      return
    }
    if (!/^[\w\s-]+$/.test(word)) {
      ctx.status = 400
      ctx.body = { error: '无效的单词' }
      logger.warn(`[confirm] ${word} — 无效格式`)
      return
    }
    const imageUrl = unsplashClient.getCandidateUrl(word, candidateId)
    if (!imageUrl) {
      ctx.status = 400
      ctx.body = { error: '无效或已过期的 candidateId' }
      logger.warn(`[confirm] ${word} — 无效或已过期的 candidateId, 缓存已清除, 当前无此候选`)
      return
    }
    try {
      const saved = await unsplashClient.downloadImage(imageUrl, word)
      if (!saved) {
        ctx.status = 500
        ctx.body = { error: '图片下载失败' }
        logger.error(`[confirm] ${word} — 图片下载失败`)
        return
      }
      unsplashClient.consumeCandidate(word, candidateId)
      ctx.body = { word, imageUrl: unsplashClient.getImageUrl(word) }
      logger.info(`[confirm] ${word} — 换图成功`)
    } catch (e) {
      ctx.status = 500
      ctx.body = { error: e.message }
      logger.error(
        `[confirm] ${word} — 图片下载异常，candidateId 保留可重试: ${e.message}` +
        `${e.cause?.message ? `, cause=${e.cause.message}` : ''}`
      )
    }
  })
}

module.exports = registerAdminRoutes
