import { describe, expect, it } from 'vitest'
import { appRegistry } from './appRegistry'

const REQUIRED_FIELDS = [
  'id',
  'name',
  'description',
  'entryPath',
  'routePrefix',
  'navigationLabel',
  'icon',
]

describe('appRegistry', () => {
  it('注册项包含平台要求的可序列化字段', () => {
    expect(appRegistry.length).toBeGreaterThan(0)

    for (const app of appRegistry) {
      expect(Object.keys(app).sort()).toEqual([...REQUIRED_FIELDS].sort())
      expect(REQUIRED_FIELDS.every((field) => typeof app[field] === 'string' && app[field]))
        .toBe(true)
      expect(() => JSON.stringify(app)).not.toThrow()
    }
  })

  it('应用 ID、入口路径和路由前缀保持唯一', () => {
    for (const field of ['id', 'entryPath', 'routePrefix']) {
      const values = appRegistry.map((app) => app[field])
      expect(new Set(values).size).toBe(values.length)
    }
  })

  it('管理路径为规范的绝对路径', () => {
    for (const app of appRegistry) {
      expect(app.entryPath).toMatch(/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(app.routePrefix).toBe(app.entryPath)
      expect(app.entryPath).not.toMatch(/\/$/)
    }
  })

  it('注册表及注册项不可被意外修改', () => {
    expect(Object.isFrozen(appRegistry)).toBe(true)
    expect(appRegistry.every(Object.isFrozen)).toBe(true)
  })
})
