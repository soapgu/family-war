import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Button, Input, Modal, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { API_BASE } from '../utils/api'

export const AuthContext = createContext({ logout: () => {} })

export function useAuth() {
  return useContext(AuthContext)
}

function RequireAuth({ children }) {
  const [authenticated, setAuthenticated] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const logout = useCallback(() => {
    setAuthenticated(false)
    setShowLogin(true)
  }, [])

  async function checkAuth() {
    try {
      const res = await fetch(API_BASE + '/api/admin/status')
      if (res.ok) {
        setAuthenticated(true)
      } else {
        setAuthenticated(false)
        setShowLogin(true)
      }
    } catch {
      setAuthenticated(false)
      setShowLogin(true)
    }
  }

  useEffect(() => { checkAuth() }, [])

  useEffect(() => {
    if (authenticated === false) setShowLogin(true)
  }, [authenticated])

  async function handleLogin() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(API_BASE + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        setAuthenticated(true)
        setShowLogin(false)
        setPassword('')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || '登录失败')
      }
    } catch {
      setError('登录请求失败')
    } finally {
      setLoading(false)
    }
  }

  if (authenticated === null) return null

  return (
    <>
      <Modal
        open={showLogin}
        title="管理员登录"
        closable={false}
        maskClosable={false}
        destroyOnClose
        footer={
          <Button
            type="primary"
            icon={<LockOutlined />}
            onClick={handleLogin}
            loading={loading}
            block
            size="large"
          >
            登录
          </Button>
        }
      >
        <div style={{ margin: '16px 0' }}>
          <Input.Password
            autoFocus
            placeholder="请输入管理密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={handleLogin}
            size="large"
            status={error ? 'error' : undefined}
          />
        </div>
        {error && (
          <Typography.Text type="danger">{error}</Typography.Text>
        )}
      </Modal>
      <AuthContext.Provider value={{ logout }}>
        {authenticated && children}
      </AuthContext.Provider>
    </>
  )
}

export default RequireAuth
