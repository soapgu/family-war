import { createContext, useContext } from 'react'

const AdminAuthContext = createContext({
  logout: async () => {},
  expireSession: () => {},
})

export function AdminAuthProvider({ children, logout, expireSession = logout }) {
  return (
    <AdminAuthContext.Provider value={{ logout, expireSession }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  return useContext(AdminAuthContext)
}
