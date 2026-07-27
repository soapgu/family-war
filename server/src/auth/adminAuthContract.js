/**
 * v3.5 管理员认证契约。
 *
 * Phase 1 只冻结协议，不切换现有路由；Phase 2 的路由、中间件和测试必须复用
 * 这里的路径、Cookie 与 JWT 声明，避免服务端和管理端各自维护魔法字符串。
 */
const ADMIN_AUTH_PATHS = Object.freeze({
  login: '/api/admin-auth/login',
  me: '/api/admin-auth/me',
  logout: '/api/admin-auth/logout',
})

const ADMIN_SESSION_COOKIE = Object.freeze({
  name: 'admin_session',
  maxAgeMs: 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
})

const ADMIN_TOKEN_CLAIMS = Object.freeze({
  subject: 'admin',
  role: 'admin',
  tokenType: 'admin-session',
  audience: 'admin-client',
  issuer: 'family-war-admin-auth',
  expiresIn: '24h',
})

const ADMIN_AUTH_RESPONSES = Object.freeze({
  loginSuccess: Object.freeze({ success: true }),
  currentAdmin: Object.freeze({
    authenticated: true,
    admin: Object.freeze({
      id: 'admin',
      role: 'admin',
      displayName: '管理员',
    }),
  }),
  logoutSuccess: Object.freeze({ success: true }),
})

module.exports = {
  ADMIN_AUTH_PATHS,
  ADMIN_SESSION_COOKIE,
  ADMIN_TOKEN_CLAIMS,
  ADMIN_AUTH_RESPONSES,
}
