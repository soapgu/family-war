const roomManager = require('../socket/roomManager')
const gameManager = require('../socket/gameManager')

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
}

module.exports = registerAdminRoutes
