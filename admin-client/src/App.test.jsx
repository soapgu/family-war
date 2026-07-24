import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

function renderAt(pathname) {
  window.history.replaceState({}, '', pathname)
  return render(<App />)
}

describe('Admin App', () => {
  it('renders the admin landing page', () => {
    renderAt('/admin/')

    expect(screen.getByText('管理平台')).toBeInTheDocument()
    expect(screen.getByText('admin-client 工程骨架已建立')).toBeInTheDocument()
  })

  it('navigates to the family-war placeholder', async () => {
    renderAt('/admin/')

    fireEvent.click(screen.getByRole('button', { name: '进入 Family War 管理' }))

    expect(await screen.findByText('Family War 管理')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/family-war')
  })

  it('redirects unknown routes to the admin landing page', async () => {
    renderAt('/admin/unknown')

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin')
    })
    expect(screen.getByText('管理平台')).toBeInTheDocument()
  })
})
