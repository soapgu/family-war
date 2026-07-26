import { describe, expect, it } from 'vitest'
import { familyWarApp, familyWarRoutes } from '.'

describe('family-war 模块公开入口', () => {
  it('公开稳定的应用元数据', () => {
    expect(familyWarApp).toEqual({
      id: 'family-war',
      name: 'Family War',
      description: '查看在线房间、历史对局和默写词库配置。',
      entryPath: '/family-war',
      routePrefix: '/family-war',
      navigationLabel: 'Family War',
      icon: 'control',
    })
  })

  it('只通过公开契约提供固定模块路由', () => {
    expect(familyWarRoutes.map(({ id, path, Component }) => ({
      id,
      path,
      hasComponent: typeof Component === 'function',
    }))).toEqual([
      {
        id: 'family-war-overview',
        path: 'family-war',
        hasComponent: true,
      },
      {
        id: 'family-war-word-config',
        path: 'family-war/word-config',
        hasComponent: true,
      },
    ])
  })

  it('模块元数据和路由契约不可被意外修改', () => {
    expect(Object.isFrozen(familyWarApp)).toBe(true)
    expect(Object.isFrozen(familyWarRoutes)).toBe(true)
    expect(familyWarRoutes.every(Object.isFrozen)).toBe(true)
  })
})
