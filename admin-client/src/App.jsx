import { App as AntApp } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import AdminApp from './app/AdminApp'

export default function App() {
  return (
    <BrowserRouter
      basename="/admin"
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <AntApp>
        <AdminApp />
      </AntApp>
    </BrowserRouter>
  )
}
