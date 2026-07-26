import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminLayout, { navigationItems } from './AdminLayout'

function renderAt(pathname) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="*" element={<div>页面内容</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLayout', () => {
  it('从应用注册表生成平台导航', () => {
    expect(navigationItems.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: '/', label: '管理首页' },
      { key: '/family-war', label: 'Family War' },
    ])
  })

  it.each([
    ['/', '管理首页'],
    ['/family-war', 'Family War'],
    ['/family-war/word-config', 'Family War'],
  ])('在 %s 选中 %s 导航', (pathname, label) => {
    renderAt(pathname)

    expect(screen.getByRole('menuitem', { name: new RegExp(`${label}$`) })).toHaveClass('ant-menu-item-selected')
  })

  it('404 地址不错误选中管理首页', () => {
    renderAt('/missing-page')

    expect(screen.getByRole('menuitem', { name: /管理首页$/ })).not.toHaveClass('ant-menu-item-selected')
    expect(screen.getByRole('menuitem', { name: /Family War$/ })).not.toHaveClass('ant-menu-item-selected')
  })
})
