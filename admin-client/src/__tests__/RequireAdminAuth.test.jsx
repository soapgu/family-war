import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import RequireAdminAuth from '../auth/RequireAdminAuth'
import { useAdminAuth } from '../auth/AdminAuthContext'

function Child() {
  const { logout } = useAdminAuth()
  return <div>管理后台 <button onClick={logout}>登出</button></div>
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  }
}

function renderAuth() {
  return render(<RequireAdminAuth><Child /></RequireAdminAuth>)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RequireAdminAuth', () => {
  it('初始验证中不渲染内容，并使用同源 Cookie 请求状态接口', async () => {
    fetch.mockResolvedValueOnce(response({ ok: true }))
    const { container } = renderAuth()
    expect(container.innerHTML).toBe('')

    expect(await screen.findByText('管理后台')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/status', undefined)
  })

  it('状态验证失败时弹出登录窗口', async () => {
    fetch.mockResolvedValueOnce(response({ error: 'unauthorized' }, 401))
    renderAuth()

    expect(await screen.findByText('管理员登录')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入管理密码')).toBeInTheDocument()
  })

  it('状态请求异常时弹出登录窗口', async () => {
    fetch.mockRejectedValueOnce(new Error('network error'))
    renderAuth()

    expect(await screen.findByText('管理员登录')).toBeInTheDocument()
  })

  it('正确密码登录后隐藏窗口', async () => {
    fetch
      .mockResolvedValueOnce(response({ error: 'unauthorized' }, 401))
      .mockResolvedValueOnce(response({ ok: true }))
    renderAuth()
    await screen.findByText('管理员登录')

    fireEvent.change(screen.getByPlaceholderText('请输入管理密码'), {
      target: { value: 'secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: /登录/ }))

    await waitFor(() => expect(screen.queryByText('管理员登录')).not.toBeInTheDocument())
    expect(screen.getByText('管理后台')).toBeInTheDocument()
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/admin/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'secret' }),
      }),
    )
  })

  it('错误密码显示服务端错误信息', async () => {
    fetch
      .mockResolvedValueOnce(response({ error: 'unauthorized' }, 401))
      .mockResolvedValueOnce(response({ error: '密码错误' }, 401))
    renderAuth()
    await screen.findByText('管理员登录')

    fireEvent.change(screen.getByPlaceholderText('请输入管理密码'), {
      target: { value: 'wrong' },
    })
    fireEvent.click(screen.getByRole('button', { name: /登录/ }))
    expect(await screen.findByText('密码错误')).toBeInTheDocument()
  })

  it('登录网络错误显示通用信息', async () => {
    fetch
      .mockResolvedValueOnce(response({ error: 'unauthorized' }, 401))
      .mockRejectedValueOnce(new Error('network error'))
    renderAuth()
    await screen.findByText('管理员登录')

    fireEvent.change(screen.getByPlaceholderText('请输入管理密码'), {
      target: { value: 'secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: /登录/ }))
    expect(await screen.findByText('登录请求失败')).toBeInTheDocument()
  })

  it('登出后重新显示登录窗口', async () => {
    fetch.mockResolvedValueOnce(response({ ok: true }))
    renderAuth()
    await screen.findByText('管理后台')

    act(() => screen.getByRole('button', { name: '登出' }).click())

    expect(await screen.findByText('管理员登录')).toBeInTheDocument()
    expect(screen.queryByText('管理后台')).not.toBeInTheDocument()
  })
})
