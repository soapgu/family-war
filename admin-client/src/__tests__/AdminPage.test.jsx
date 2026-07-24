import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminAuthProvider } from '../auth/AdminAuthContext'
import AdminPage from '../modules/family-war/AdminPage'

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  }
}

function renderPage(logout = vi.fn()) {
  return render(
    <MemoryRouter>
      <AdminAuthProvider logout={logout}>
        <AdminPage />
      </AdminAuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    response({ rooms: [], matchHistory: [] }),
  ))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AdminPage', () => {
  it('展示标题、统计卡片和空状态', async () => {
    renderPage()

    expect(screen.getByRole('heading', { name: '后台管理' })).toBeInTheDocument()
    expect(screen.getByText('在线房间')).toBeInTheDocument()
    expect(screen.getByText('在线玩家')).toBeInTheDocument()
    expect(screen.getByText('历史对局')).toBeInTheDocument()
    expect(await screen.findByText('暂无活跃房间')).toBeInTheDocument()
    expect(screen.getByText('暂无对局记录')).toBeInTheDocument()
  })

  it('点击刷新重新请求管理状态', async () => {
    renderPage()
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole('button', { name: /刷新/ }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith('/api/admin/status', undefined)
  })

  it('状态接口返回 401 时退出登录', async () => {
    const logout = vi.fn()
    fetch.mockResolvedValueOnce(response({ error: 'unauthorized' }, 401))

    renderPage(logout)

    await waitFor(() => expect(logout).toHaveBeenCalledOnce())
  })
})
