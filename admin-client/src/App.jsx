import { App as AntApp, Button, Card, Space, Typography } from 'antd'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import RequireAdminAuth from './auth/RequireAdminAuth'
import AdminLayout from './layout/AdminLayout'
import { familyWarRoutes } from './modules/family-war'

function AdminHomePage() {
  const navigate = useNavigate()

  return (
    <main className="admin-home">
      <Typography.Title level={2}>管理首页</Typography.Title>
      <Typography.Paragraph type="secondary">
        选择需要管理的应用。
      </Typography.Paragraph>
      <Card title="Family War" className="admin-app-card">
        <Space direction="vertical">
          <Typography.Text>查看在线房间、历史对局和默写词库配置。</Typography.Text>
          <Button type="primary" onClick={() => navigate('/family-war')}>
            进入管理
          </Button>
        </Space>
      </Card>
    </main>
  )
}

function AdminRoutes() {
  return (
    <Routes>
      <Route
        element={(
          <RequireAdminAuth>
            <AdminLayout />
          </RequireAdminAuth>
        )}
      >
        <Route index element={<AdminHomePage />} />
        {familyWarRoutes.map(({ id, path, Component }) => (
          <Route key={id} path={path} element={<Component />} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter
      basename="/admin"
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <AntApp>
        <AdminRoutes />
      </AntApp>
    </BrowserRouter>
  )
}
