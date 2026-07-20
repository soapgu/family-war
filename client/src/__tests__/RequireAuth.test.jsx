import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import RequireAuth, { useAuth } from '../components/RequireAuth'

function Child() {
  const { logout } = useAuth()
  return <div>管理后台 <button onClick={logout}>登出</button></div>
}

function response(body, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(body) }
}

function renderAuth() {
  return render(<RequireAuth><Child /></RequireAuth>)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RequireAuth', () => {
  it('初始验证中返回 null', () => {
    const { container } = renderAuth()
    expect(container.innerHTML).toBe('')
  })

  it('状态验证通过后渲染子组件', async () => {
    fetch.mockResolvedValueOnce(response({ ok: true }))
    renderAuth()
    expect(await screen.findByText('管理后台')).toBeInTheDocument()
  })

  it('状态验证失败弹出登录弹窗', async () => {
    fetch.mockResolvedValueOnce(response({ error: 'unauthorized' }, false))
    renderAuth()
    expect(await screen.findByText('管理员登录')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入管理密码')).toBeInTheDocument()
  })

  it('网络异常也弹出登录弹窗', async () => {
    fetch.mockRejectedValueOnce(new Error('network error'))
    renderAuth()
    expect(await screen.findByText('管理员登录')).toBeInTheDocument()
  })

  it('正确密码登录后隐藏弹窗', async () => {
    fetch.mockResolvedValueOnce(response({ ok: true }))
    renderAuth()
    await screen.findByText('管理后台')

    act(() => screen.getByText('登出').click())
    await screen.findByText('管理员登录')

    fetch.mockResolvedValueOnce(response({ ok: true }))
    fireEvent.change(screen.getByPlaceholderText('请输入管理密码'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'lock 登录' }))

    await waitFor(() => expect(screen.queryByText('管理员登录')).not.toBeInTheDocument())
    expect(screen.getByText('管理后台')).toBeInTheDocument()
  })

  it('错误密码显示错误信息', async () => {
    fetch.mockResolvedValueOnce(response({ error: 'unauthorized' }, false))
    renderAuth()
    await screen.findByText('管理员登录')

    fetch.mockResolvedValueOnce(response({ error: '密码错误' }, false))
    fireEvent.change(screen.getByPlaceholderText('请输入管理密码'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'lock 登录' }))

    expect(await screen.findByText('密码错误')).toBeInTheDocument()
  })

  it('网络错误显示通用提示', async () => {
    fetch.mockResolvedValueOnce(response({ error: 'unauthorized' }, false))
    renderAuth()
    await screen.findByText('管理员登录')

    fetch.mockRejectedValueOnce(new Error('net error'))
    fireEvent.change(screen.getByPlaceholderText('请输入管理密码'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'lock 登录' }))

    expect(await screen.findByText('登录请求失败')).toBeInTheDocument()
  })

  it('登出后再次弹出登录弹窗', async () => {
    fetch.mockResolvedValueOnce(response({ ok: true }))
    renderAuth()
    await screen.findByText('管理后台')

    fetch.mockResolvedValueOnce(response({ ok: true }))
    act(() => screen.getByText('登出').click())
    await screen.findByText('管理员登录')

    expect(screen.queryByText('管理后台')).not.toBeInTheDocument()
  })
})
