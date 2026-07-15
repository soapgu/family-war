import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Admin from '../pages/Admin'

describe('Admin', () => {
  function renderAdmin() {
    return render(<MemoryRouter><Admin /></MemoryRouter>)
  }

  it('renders admin title', () => {
    renderAdmin()
    expect(screen.getByText('后台管理')).toBeInTheDocument()
  })

  it('shows empty state initially', () => {
    renderAdmin()
    expect(screen.getByText('暂无活跃房间')).toBeInTheDocument()
    expect(screen.getByText('暂无对局记录')).toBeInTheDocument()
  })

  it('shows stat cards', () => {
    renderAdmin()
    expect(screen.getByText('在线房间')).toBeInTheDocument()
    expect(screen.getByText('在线玩家')).toBeInTheDocument()
    expect(screen.getByText('历史对局')).toBeInTheDocument()
  })
})
