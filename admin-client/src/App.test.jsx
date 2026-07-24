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
    json: async () => ({ rooms: [], matchHistory: [] }),
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

  it('redirects unknown routes to the admin landing page', async () => {
    renderAt('/admin/unknown')

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin')
    })
    expect(await screen.findByRole('heading', { name: '管理首页' })).toBeInTheDocument()
  })
})
