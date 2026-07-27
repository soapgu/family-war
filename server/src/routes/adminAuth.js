const jwt = require('jsonwebtoken')
const config = require('../../config')
const {
  ADMIN_AUTH_PATHS,
  ADMIN_SESSION_COOKIE,
  ADMIN_TOKEN_CLAIMS,
  ADMIN_AUTH_RESPONSES,
} = require('../auth/adminAuthContract')
const {
  getAdminAuthConfigError,
  getJwtSecret,
} = require('../middleware/auth')
const logger = require('../logger')

function cookieOptions(ctx, maxAge = ADMIN_SESSION_COOKIE.maxAgeMs) {
  return {
    httpOnly: ADMIN_SESSION_COOKIE.httpOnly,
    sameSite: ADMIN_SESSION_COOKIE.sameSite,
    maxAge,
    path: ADMIN_SESSION_COOKIE.path,
    secure: ctx.secure,
  }
}

/**
 * 平台管理员身份接口。
 *
 * 此模块只负责单一管理员的登录、会话查询和退出，不得依赖 family-war 的
 * 房间、比赛、词库或图片状态。
 *
 * @param {import('@koa/router')} router
 */
function registerAdminAuthRoutes(router) {
  router.post(ADMIN_AUTH_PATHS.login, (ctx) => {
    const configError = getAdminAuthConfigError()
    if (configError) {
      ctx.status = 503
      ctx.body = { error: '管理员认证未配置' }
      logger.error(`[admin-auth] login unavailable — ${configError}`)
      return
    }

    const { password } = ctx.request.body || {}
    if (typeof password !== 'string' || password.length === 0) {
      ctx.status = 400
      ctx.body = { error: '请输入管理密码' }
      return
    }

    if (password !== config.auth.adminPassword) {
      logger.warn('[admin-auth] login FAIL — wrong password')
      ctx.status = 401
      ctx.body = { error: '密码错误' }
      return
    }

    const token = jwt.sign(
      {
        role: ADMIN_TOKEN_CLAIMS.role,
        tokenType: ADMIN_TOKEN_CLAIMS.tokenType,
      },
      getJwtSecret(),
      {
        subject: ADMIN_TOKEN_CLAIMS.subject,
        audience: ADMIN_TOKEN_CLAIMS.audience,
        issuer: ADMIN_TOKEN_CLAIMS.issuer,
        expiresIn: ADMIN_TOKEN_CLAIMS.expiresIn,
      },
    )

    ctx.cookies.set(
      ADMIN_SESSION_COOKIE.name,
      token,
      cookieOptions(ctx),
    )
    logger.info('[admin-auth] login OK — admin session issued')
    ctx.body = ADMIN_AUTH_RESPONSES.loginSuccess
  })

  router.get(ADMIN_AUTH_PATHS.me, (ctx) => {
    ctx.body = ADMIN_AUTH_RESPONSES.currentAdmin
  })

  router.post(ADMIN_AUTH_PATHS.logout, (ctx) => {
    const hadCookie = !!ctx.cookies.get(ADMIN_SESSION_COOKIE.name)
    ctx.cookies.set(
      ADMIN_SESSION_COOKIE.name,
      null,
      cookieOptions(ctx, -1),
    )
    logger.info(`[admin-auth] logout — session ${hadCookie ? 'cleared' : 'already empty'}`)
    ctx.body = ADMIN_AUTH_RESPONSES.logoutSuccess
  })
}

module.exports = registerAdminAuthRoutes
