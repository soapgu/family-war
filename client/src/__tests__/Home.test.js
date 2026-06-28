import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import useSocket from '../hooks/useSocket'
import Home from '../pages/Home'

jest.mock('../hooks/useSocket')
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: { error: jest.fn(), ...jest.requireActual('antd').message },
}))

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

function renderHome() {
  return render(<BrowserRouter><Home /></BrowserRouter>)
}

describe('Home', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders title', () => {
    renderHome()
    expect(screen.getByText('Family War')).toBeInTheDocument()
  })

  it('renders nickname input', () => {
    renderHome()
    expect(screen.getByPlaceholderText('输入昵称')).toBeInTheDocument()
  })

  it('renders enter button', () => {
    renderHome()
    expect(screen.getByRole('button', { name: '进入房间' })).toBeInTheDocument()
  })

  it('calls socket.emit with nickname on enter', async () => {
    renderHome()
    const socket = useSocket()

    await userEvent.type(screen.getByPlaceholderText('输入昵称'), '小明')
    await userEvent.click(screen.getByRole('button', { name: '进入房间' }))

    expect(socket.emit).toHaveBeenCalledWith('room:join', { nickname: '小明' })
  })

  it('does not emit when nickname is empty', async () => {
    renderHome()
    const socket = useSocket()

    await userEvent.click(screen.getByRole('button', { name: '进入房间' }))

    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('navigates to /room on room:state', () => {
    const socket = useSocket()
    renderHome()
    const handler = socket.on.mock.calls.find(([e]) => e === 'room:state')[1]
    handler({ id: 'default', players: [] })
    expect(mockNavigate).toHaveBeenCalledWith('/room')
  })
})
