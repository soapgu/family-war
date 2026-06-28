import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '../pages/Home'

describe('Home', () => {
  it('renders title', () => {
    render(<Home onEnter={jest.fn()} />)
    expect(screen.getByText('Family War')).toBeInTheDocument()
  })

  it('renders nickname input', () => {
    render(<Home onEnter={jest.fn()} />)
    expect(screen.getByPlaceholderText('输入昵称')).toBeInTheDocument()
  })

  it('renders enter button', () => {
    render(<Home onEnter={jest.fn()} />)
    expect(screen.getByRole('button', { name: '进入房间' })).toBeInTheDocument()
  })

  it('calls onEnter with nickname on click', async () => {
    const onEnter = jest.fn()
    render(<Home onEnter={onEnter} />)

    await userEvent.type(screen.getByPlaceholderText('输入昵称'), '小明')
    await userEvent.click(screen.getByRole('button', { name: '进入房间' }))

    expect(onEnter).toHaveBeenCalledWith('小明')
  })

  it('does not call onEnter when nickname is empty', async () => {
    const onEnter = jest.fn()
    render(<Home onEnter={onEnter} />)

    await userEvent.click(screen.getByRole('button', { name: '进入房间' }))

    expect(onEnter).not.toHaveBeenCalled()
  })
})
