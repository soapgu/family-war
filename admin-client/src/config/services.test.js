import { describe, expect, it } from 'vitest'
import { createServiceConfig, joinServicePath } from './services'

describe('管理端服务路径配置', () => {
  it('开发环境使用 Vite 的 /api 代理', () => {
    expect(createServiceConfig({ isDev: true })).toEqual({
      FAMILY_WAR_API_BASE: '/api',
    })
  })

  it('生产环境使用标准 family-war API 命名空间', () => {
    expect(createServiceConfig({ isDev: false })).toEqual({
      FAMILY_WAR_API_BASE: '/api/family-war',
    })
  })

  it('连接 API 基址与业务路径时统一处理斜杠', () => {
    expect(joinServicePath('/api/family-war/', '/admin/status')).toBe('/api/family-war/admin/status')
    expect(joinServicePath('/api', 'admin/login')).toBe('/api/admin/login')
    expect(joinServicePath('', '')).toBe('/')
  })
})
