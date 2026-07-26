import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAdminAuth from '../auth/RequireAdminAuth'
import AdminLayout from '../layout/AdminLayout'
import { familyWarRoutes } from '../modules/family-war'
import AdminHomePage from '../pages/AdminHomePage'

export default function AdminRoutes() {
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
