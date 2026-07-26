import { ApiRequestError, requestJson } from './request'

describe('requestJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('返回成功响应中的 JSON 数据', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ value: 1 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    await expect(requestJson('/api/example')).resolves.toEqual({ value: 1 })
  })

  it('保留 HTTP 状态和服务端错误信息', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: '服务暂时不可用' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )))

    await expect(requestJson('/api/example')).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 500,
      message: '服务暂时不可用',
    })
  })

  it('将网络异常转换为不含底层细节的统一错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('private network detail')))

    await expect(requestJson('/api/example')).rejects.toEqual(expect.objectContaining({
      name: 'ApiRequestError',
      status: null,
      message: '网络连接失败，请稍后重试',
    }))
    await requestJson('/api/example').catch((error) => {
      expect(error).toBeInstanceOf(ApiRequestError)
      expect(error.message).not.toContain('private network detail')
    })
  })
})
