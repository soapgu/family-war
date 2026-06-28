import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Admin from '../pages/Admin'

function renderWithRouter(ui) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('Admin', () => {
  it('renders admin title', () => {
    renderWithRouter(<Admin />)
    expect(screen.getByText('后台管理')).toBeInTheDocument()
  })
})
