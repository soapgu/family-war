const roomManager = require('../socket/roomManager')
const gameManager = require('../socket/gameManager')
const unsplashClient = require('../unsplashClient')
const config = require('../../config')

const SYNC_LOCK = new Set()

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
}

module.exports = registerAdminRoutes
