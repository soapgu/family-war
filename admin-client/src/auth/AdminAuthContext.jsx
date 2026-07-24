import { createContext, useCallback, useContext } from 'react'

const AdminAuthContext = createContext({ logout: () => {} })

export function AdminAuthProvider({ children, logout }) {
  return (
    <AdminAuthContext.Provider value={{ logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  return useContext(AdminAuthContext)
}

export function useAdminLogout(setAuthenticated, setShowLogin) {
  return useCallback(() => {
    setAuthenticated(false)
    setShowLogin(true)
  }, [setAuthenticated, setShowLogin])
}
