const {
  ADMIN_AUTH_PATHS,
  ADMIN_SESSION_COOKIE,
  ADMIN_TOKEN_CLAIMS,
  ADMIN_AUTH_RESPONSES,
} = require('../src/auth/adminAuthContract')

describe('v3.5 管理员认证契约', () => {
  it('身份接口使用独立且稳定的公网路径', () => {
    expect(ADMIN_AUTH_PATHS).toEqual({
      login: '/api/admin-auth/login',
      me: '/api/admin-auth/me',
      logout: '/api/admin-auth/logout',
    })
    expect(new Set(Object.values(ADMIN_AUTH_PATHS)).size).toBe(3)
    for (const path of Object.values(ADMIN_AUTH_PATHS)) {
      expect(path).toMatch(/^\/api\/admin-auth\/[a-z-]+$/)
      expect(path).not.toContain('/family-war/')
    }
  })

  it('管理员会话只使用独立 HttpOnly Cookie', () => {
    expect(ADMIN_SESSION_COOKIE).toEqual({
      name: 'admin_session',
      maxAgeMs: 86400000,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
    expect(ADMIN_SESSION_COOKIE.name).not.toBe('admin_token')
  })

  it('管理员 JWT 具有独立类型、受众和签发者边界', () => {
    expect(ADMIN_TOKEN_CLAIMS).toEqual({
      subject: 'admin',
      role: 'admin',
      tokenType: 'admin-session',
      audience: 'admin-client',
      issuer: 'family-war-admin-auth',
      expiresIn: '24h',
    })
  })

  it('成功响应不暴露 JWT 或 Cookie 内容', () => {
    expect(ADMIN_AUTH_RESPONSES).toEqual({
      loginSuccess: { success: true },
      currentAdmin: {
        authenticated: true,
        admin: {
          id: 'admin',
          role: 'admin',
          displayName: '管理员',
        },
      },
      logoutSuccess: { success: true },
    })

    const serialized = JSON.stringify(ADMIN_AUTH_RESPONSES)
    expect(serialized).not.toMatch(/token|cookie|secret|password/i)
  })

  it('契约常量不可在运行时被改写', () => {
    expect(Object.isFrozen(ADMIN_AUTH_PATHS)).toBe(true)
    expect(Object.isFrozen(ADMIN_SESSION_COOKIE)).toBe(true)
    expect(Object.isFrozen(ADMIN_TOKEN_CLAIMS)).toBe(true)
    expect(Object.isFrozen(ADMIN_AUTH_RESPONSES)).toBe(true)
    expect(Object.isFrozen(ADMIN_AUTH_RESPONSES.currentAdmin.admin)).toBe(true)
  })
})
