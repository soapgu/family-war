const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const config = require('../../config')

const jwtSecret = config.auth.jwtSecret || crypto.randomBytes(32).toString('hex')
const loginAttempts = new Map()

function getJwtSecret() {
  return jwtSecret
}

function loginRateLimitMiddleware(ctx, next) {
  if (ctx.path !== '/api/admin/login' || ctx.method !== 'POST') return next()

  const ip = ctx.ip
  const now = Date.now()
  let record = loginAttempts.get(ip)

  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + 60000 }
    loginAttempts.set(ip, record)
  }

  record.count++

  if (record.count > 5) {
    ctx.status = 429
    ctx.body = { error: '登录尝试过于频繁，请稍后再试' }
    return
  }

  return next()
}

function originCheckMiddleware(ctx, next) {
  if (ctx.method === 'POST' && ctx.path.startsWith('/api/admin') && ctx.path !== '/api/admin/login') {
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
  const whitelist = ['/api/admin/login', '/api/admin/logout']
  if (whitelist.includes(ctx.path)) return next()

  if (!ctx.path.startsWith('/api/admin')) return next()

  const token = ctx.cookies.get('admin_token')
  if (!token) {
    ctx.status = 401
    ctx.body = { error: '未登录' }
    return
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret())
    if (decoded.role !== 'admin') {
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
  getJwtSecret,
  startCleanup,
  resetLoginAttempts,
}
