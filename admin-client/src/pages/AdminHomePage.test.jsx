import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AdminHomePage from './AdminHomePage'

function CurrentPath() {
  return <output aria-label="当前路径">{useLocation().pathname}</output>
}

function renderHome(apps) {
  return render(
    <MemoryRouter>
      <AdminHomePage apps={apps} />
      <CurrentPath />
    </MemoryRouter>,
  )
}

describe('AdminHomePage', () => {
  it('从注册表渲染应用入口并导航到注册路径', () => {
    renderHome([{
      id: 'sample-app',
      name: '示例应用',
      description: '示例应用管理说明。',
      entryPath: '/sample-app',
    }])

    expect(screen.getByRole('heading', { name: '管理首页' })).toBeInTheDocument()
    expect(screen.getByText('示例应用')).toBeInTheDocument()
    expect(screen.getByText('示例应用管理说明。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '进入管理' }))
    expect(screen.getByLabelText('当前路径')).toHaveTextContent('/sample-app')
  })

  it('默认渲染已注册的 Family War 应用', () => {
    renderHome()

    expect(screen.getByText('Family War')).toBeInTheDocument()
    expect(screen.getByText('查看在线房间、历史对局和默写词库配置。')).toBeInTheDocument()
  })

  it('注册表为空时显示明确空状态', () => {
    renderHome([])

    expect(screen.getByText('暂无可管理应用')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '进入管理' })).not.toBeInTheDocument()
  })
})
