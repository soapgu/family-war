import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

function renderAt(pathname) {
  window.history.replaceState({}, '', pathname)
  return render(<App />)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      rooms: [],
      matchHistory: [],
      chapters: [],
      enabledChapters: [],
      disabledWords: [],
    }),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Admin App', () => {
  it('renders the authenticated admin landing page', async () => {
    renderAt('/admin/')

    expect(await screen.findByRole('heading', { name: '管理首页' })).toBeInTheDocument()
    expect(screen.getByText('选择需要管理的应用。')).toBeInTheDocument()
  })

  it('navigates to the family-war admin page', async () => {
    renderAt('/admin/')

    fireEvent.click(await screen.findByRole('button', { name: '进入管理' }))

    expect(await screen.findByRole('heading', { name: '后台管理' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/family-war')
  })

  it.each([
    ['/admin/family-war', '后台管理'],
    ['/admin/family-war/', '后台管理'],
    ['/admin/family-war/word-config', '词库管理'],
  ])('renders route %s', async (pathname, heading) => {
    renderAt(pathname)

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('supports navigation between dashboard and word config', async () => {
    renderAt('/admin/family-war')
    fireEvent.click(await screen.findByRole('button', { name: '词库管理' }))

    expect(await screen.findByRole('heading', { name: '词库管理' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/family-war/word-config')

    fireEvent.click(screen.getByRole('button', { name: '返回管理' }))
    expect(await screen.findByRole('heading', { name: '后台管理' })).toBeInTheDocument()
  })

  it('redirects unknown routes to the admin landing page', async () => {
    renderAt('/admin/unknown')

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin')
    })
    expect(await screen.findByRole('heading', { name: '管理首页' })).toBeInTheDocument()
  })
})
