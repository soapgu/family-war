import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RoleCard from '../components/RoleCard'

describe('RoleCard', () => {
  it('shows role name', () => {
    render(<RoleCard role="爸爸" occupant={null} isMine={false} onClick={jest.fn()} />)
    expect(screen.getByText('爸爸')).toBeInTheDocument()
  })

  it('shows 空闲 when no occupant', () => {
    render(<RoleCard role="爸爸" occupant={null} isMine={false} onClick={jest.fn()} />)
    expect(screen.getByText('空闲')).toBeInTheDocument()
  })

  it('shows occupant nickname when taken', () => {
    render(<RoleCard role="妈妈" occupant={{ nickname: '小红' }} isMine={false} onClick={jest.fn()} />)
    expect(screen.getByText('小红')).toBeInTheDocument()
  })

  it('shows 我 when isMine', () => {
    render(<RoleCard role="爸爸" occupant={{ nickname: '小明' }} isMine={true} onClick={jest.fn()} />)
    expect(screen.getByText(/我/)).toBeInTheDocument()
  })

  it('calls onClick with role when free and clicked', async () => {
    const onClick = jest.fn()
    render(<RoleCard role="爸爸" occupant={null} isMine={false} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledWith('爸爸')
  })

  it('does not call onClick when occupied by others', async () => {
    const onClick = jest.fn()
    render(<RoleCard role="爸爸" occupant={{ nickname: '小明' }} isMine={false} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls onClick when isMine (deselect)', async () => {
    const onClick = jest.fn()
    render(<RoleCard role="爸爸" occupant={{ nickname: '小明' }} isMine={true} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledWith('爸爸')
  })
})
