import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Room from '../pages/Room'

jest.mock('../hooks/useSocket')

function renderWithRouter(ui) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('Room', () => {
  it('renders room title', () => {
    renderWithRouter(<Room />)
    expect(screen.getByText('游戏房间')).toBeInTheDocument()
  })

  it('shows room id', () => {
    renderWithRouter(<Room />)
    expect(screen.getByText(/default/)).toBeInTheDocument()
  })
})
