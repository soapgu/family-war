const jwt = require('jsonwebtoken')
const config = require('../../config')
const {
  ADMIN_AUTH_PATHS,
  ADMIN_SESSION_COOKIE,
  ADMIN_TOKEN_CLAIMS,
} = require('../auth/adminAuthContract')

const loginAttempts = new Map()

function getJwtSecret() {
  return config.auth.jwtSecret
}

function getAdminAuthConfigError() {
  if (!config.auth.adminPassword) return 'adminPassword is missing'
  if (!config.auth.jwtSecret) return 'jwtSecret is missing'
  return ''
}

function assertAdminAuthConfig() {
  const configError = getAdminAuthConfigError()
  if (process.env.NODE_ENV === 'production' && configError) {
    throw new Error(`管理员认证配置无效：${configError}`)
  }
}

async function loginRateLimitMiddleware(ctx, next) {
  if (ctx.path !== ADMIN_AUTH_PATHS.login || ctx.method !== 'POST') return next()

  const ip = ctx.ip
  const now = Date.now()
  let record = loginAttempts.get(ip)

  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + 60000 }
    loginAttempts.set(ip, record)
  }

  if (record.count >= 5) {
    ctx.status = 429
    ctx.body = { error: '登录尝试过于频繁，请稍后再试' }
    return
  }

  await next()

  if (ctx.status === 401) {
    record.count++
  } else if (ctx.status >= 200 && ctx.status < 300) {
    loginAttempts.delete(ip)
  }
}

function originCheckMiddleware(ctx, next) {
  const isAdminMutation = ctx.method === 'POST' && (
    ctx.path.startsWith('/api/admin-auth') ||
    ctx.path.startsWith('/api/admin')
  )

  if (isAdminMutation) {
    const origin = ctx.get('Origin')
    if (origin && process.env.NODE_ENV === 'production') {
      try {
        const originHost = new URL(origin).host
        if (originHost !== ctx.get('Host')) {
          ctx.status = 403
          ctx.body = { error: '拒绝的请求来源' }
          return
        }
      } catch {
        ctx.status = 403
        ctx.body = { error: '无效的请求来源' }
        return
      }
    }
  }
  return next()
}

function authMiddleware(ctx, next) {
  const whitelist = [ADMIN_AUTH_PATHS.login, ADMIN_AUTH_PATHS.logout]
  if (whitelist.includes(ctx.path)) return next()

  const removedLegacyAuthPaths = ['/api/admin/login', '/api/admin/logout']
  if (removedLegacyAuthPaths.includes(ctx.path)) return next()

  const isProtectedAdminPath = (
    ctx.path === ADMIN_AUTH_PATHS.me ||
    ctx.path.startsWith('/api/admin/')
  )
  if (!isProtectedAdminPath) return next()

  if (getAdminAuthConfigError()) {
    ctx.status = 503
    ctx.body = { error: '管理员认证未配置' }
    return
  }

  const token = ctx.cookies.get(ADMIN_SESSION_COOKIE.name)
  if (!token) {
    ctx.status = 401
    ctx.body = { error: '未登录' }
    return
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret())
    if (
      decoded.sub !== ADMIN_TOKEN_CLAIMS.subject ||
      decoded.role !== ADMIN_TOKEN_CLAIMS.role ||
      decoded.tokenType !== ADMIN_TOKEN_CLAIMS.tokenType ||
      decoded.aud !== ADMIN_TOKEN_CLAIMS.audience ||
      decoded.iss !== ADMIN_TOKEN_CLAIMS.issuer
    ) {
      ctx.status = 401
      ctx.body = { error: '无效的登录状态' }
      return
    }
    ctx.state.admin = decoded
    return next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      ctx.status = 401
      ctx.body = { error: '登录已过期' }
    } else {
      ctx.status = 401
      ctx.body = { error: '登录已失效' }
    }
  }
}

function startCleanup() {
  setInterval(() => {
    const now = Date.now()
    for (const [ip, record] of loginAttempts) {
      if (now > record.resetAt) loginAttempts.delete(ip)
    }
  }, 5 * 60 * 1000)
}

function resetLoginAttempts() {
  loginAttempts.clear()
}

module.exports = {
  loginRateLimitMiddleware,
  originCheckMiddleware,
  authMiddleware,
  assertAdminAuthConfig,
  getAdminAuthConfigError,
  getJwtSecret,
  startCleanup,
  resetLoginAttempts,
}
