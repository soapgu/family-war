import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Home from '../pages/Home'

jest.mock('../hooks/useSocket')

function renderWithRouter(ui) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('Home', () => {
  it('renders title', () => {
    renderWithRouter(<Home />)
    expect(screen.getByText('Family War')).toBeInTheDocument()
  })

  it('renders nickname input', () => {
    renderWithRouter(<Home />)
    expect(screen.getByPlaceholderText('输入昵称')).toBeInTheDocument()
  })

  it('renders enter button', () => {
    renderWithRouter(<Home />)
    expect(screen.getByRole('button', { name: '进入房间' })).toBeInTheDocument()
  })
})
