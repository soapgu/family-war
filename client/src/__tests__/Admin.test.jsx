import { render, screen } from '@testing-library/react'
import Admin from '../pages/Admin'

describe('Admin', () => {
  it('renders admin title', () => {
    render(<Admin />)
    expect(screen.getByText('后台管理')).toBeInTheDocument()
  })

  it('shows empty state initially', () => {
    render(<Admin />)
    expect(screen.getByText('暂无活跃房间')).toBeInTheDocument()
    expect(screen.getByText('暂无对局记录')).toBeInTheDocument()
  })

  it('shows stat cards', () => {
    render(<Admin />)
    expect(screen.getByText('在线房间')).toBeInTheDocument()
    expect(screen.getByText('在线玩家')).toBeInTheDocument()
    expect(screen.getByText('历史对局')).toBeInTheDocument()
  })
})
