import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminAuthApi } from './api'

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ success: true })))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('管理员认证 API', () => {
  it('登录只访问独立认证服务', async () => {
    await adminAuthApi.login('secret')
    expect(fetch).toHaveBeenCalledWith('/api/admin-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret' }),
    })
  })

  it('当前管理员探测不访问 family-war 状态接口', async () => {
    await adminAuthApi.getCurrentAdmin()
    expect(fetch).toHaveBeenCalledWith('/api/admin-auth/me', undefined)
    expect(fetch.mock.calls.flat().join(' ')).not.toContain('/api/admin/status')
  })

  it('退出只访问独立认证服务', async () => {
    await adminAuthApi.logout()
    expect(fetch).toHaveBeenCalledWith('/api/admin-auth/logout', {
      method: 'POST',
    })
  })
})
