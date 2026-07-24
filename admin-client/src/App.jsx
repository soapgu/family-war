import { App as AntApp, Button, Result } from 'antd'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

function PlaceholderPage({ title, description, nextPath, nextLabel }) {
  const navigate = useNavigate()

  return (
    <main className="admin-shell">
      <Result
        status="info"
        title={title}
        subTitle={description}
        extra={nextPath ? (
          <Button type="primary" onClick={() => navigate(nextPath)}>
            {nextLabel}
          </Button>
        ) : null}
      />
    </main>
  )
}

function AdminRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={(
          <PlaceholderPage
            title="管理平台"
            description="admin-client 工程骨架已建立"
            nextPath="/family-war"
            nextLabel="进入 Family War 管理"
          />
        )}
      />
      <Route
        path="/family-war"
        element={(
          <PlaceholderPage
            title="Family War 管理"
            description="管理状态页面将在 Phase 2 迁入"
            nextPath="/family-war/word-config"
            nextLabel="查看词库管理入口"
          />
        )}
      />
      <Route
        path="/family-war/word-config"
        element={(
          <PlaceholderPage
            title="词库管理"
            description="词库管理页面将在 Phase 2 迁入"
          />
        )}
      />
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
