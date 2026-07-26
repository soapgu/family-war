import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AppErrorBoundary from './AppErrorBoundary'

function BrokenPage() {
  throw new Error('sensitive render details')
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('捕获渲染异常且不展示错误细节，并可安全返回首页', async () => {
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <AppErrorBoundary>
          <Routes>
            <Route path="/" element={<div>管理首页内容</div>} />
            <Route path="/broken" element={<BrokenPage />} />
          </Routes>
        </AppErrorBoundary>
      </MemoryRouter>,
    )

    expect(screen.getByText('页面暂时无法显示')).toBeInTheDocument()
    expect(screen.queryByText(/sensitive render details/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '返回管理首页' }))
    expect(await screen.findByText('管理首页内容')).toBeInTheDocument()
  })
})
