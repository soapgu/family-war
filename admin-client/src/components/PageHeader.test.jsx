import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PageHeader from './PageHeader'

describe('PageHeader', () => {
  it('渲染标题、说明、面包屑和操作区', () => {
    render(
      <MemoryRouter>
        <PageHeader
          title="词库管理"
          description="配置默写内容。"
          breadcrumbs={[
            { title: '管理首页', path: '/' },
            { title: 'Family War', path: '/family-war' },
            { title: '词库管理' },
          ]}
          extra={<button type="button">刷新</button>}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '词库管理' })).toBeInTheDocument()
    expect(screen.getByText('配置默写内容。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '管理首页' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Family War' })).toHaveAttribute('href', '/family-war')
    expect(screen.getByText('词库管理', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument()
  })
})
