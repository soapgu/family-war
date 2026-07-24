import { describe, expect, it } from 'vitest'
import { createServiceConfig, joinServicePath } from './services'

describe('游戏端服务路径配置', () => {
  it('开发环境保持 Vite 代理使用的 API 和 Socket.IO 路径', () => {
    expect(createServiceConfig({
      isDev: true,
      publicBase: '/family-war/',
    })).toEqual({
      PUBLIC_BASE: '/family-war',
      FAMILY_WAR_API_BASE: '/api',
      FAMILY_WAR_SOCKET_PATH: '/socket.io',
    })
  })

  it('生产环境将页面、API 和 Socket.IO 放在独立命名空间', () => {
    expect(createServiceConfig({
      isDev: false,
      publicBase: '/family-war/',
    })).toEqual({
      PUBLIC_BASE: '/family-war',
      FAMILY_WAR_API_BASE: '/api/family-war',
      FAMILY_WAR_SOCKET_PATH: '/socket/family-war/',
    })
  })

  it('连接路径时统一处理首尾斜杠', () => {
    expect(joinServicePath('/api/family-war/', '/admin/status')).toBe('/api/family-war/admin/status')
    expect(joinServicePath('', 'api/health')).toBe('/api/health')
    expect(joinServicePath('/', '')).toBe('/')
  })
})
