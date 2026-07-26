import { Route, Routes } from 'react-router-dom'
import RequireAdminAuth from '../auth/RequireAdminAuth'
import AdminLayout from '../layout/AdminLayout'
import { familyWarRoutes } from '../modules/family-war'
import AdminHomePage from '../pages/AdminHomePage'
import NotFoundPage from '../pages/NotFoundPage'
import AppErrorBoundary from '../components/AppErrorBoundary'

export default function AdminRoutes() {
  return (
    <Routes>
      <Route
        element={(
          <RequireAdminAuth>
            <AppErrorBoundary>
              <AdminLayout />
            </AppErrorBoundary>
          </RequireAdminAuth>
        )}
      >
        <Route index element={<AdminHomePage />} />
        {familyWarRoutes.map(({ id, path, Component }) => (
          <Route key={id} path={path} element={<Component />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
