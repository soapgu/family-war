import { useEffect, useState } from 'react'
import { Button, Input, Modal, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { familyWarAdminApi } from '../modules/family-war/api'
import { AdminAuthProvider, useAdminLogout } from './AdminAuthContext'

export default function RequireAdminAuth({ children }) {
  const [authenticated, setAuthenticated] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const logout = useAdminLogout(setAuthenticated, setShowLogin)

  useEffect(() => {
    let active = true

    async function checkAuth() {
      try {
        const response = await familyWarAdminApi.getStatus()
        if (!active) return
        setAuthenticated(response.ok)
        setShowLogin(!response.ok)
      } catch {
        if (!active) return
        setAuthenticated(false)
        setShowLogin(true)
      }
    }

    checkAuth()
    return () => { active = false }
  }, [])

  async function handleLogin() {
    setLoading(true)
    setError('')
    try {
      const response = await familyWarAdminApi.login(password)
      if (response.ok) {
        setAuthenticated(true)
        setShowLogin(false)
        setPassword('')
      } else {
        const data = await response.json().catch(() => ({}))
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
        destroyOnHidden
        footer={(
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
        )}
      >
        <div style={{ margin: '16px 0' }}>
          <Input.Password
            autoFocus
            placeholder="请输入管理密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onPressEnter={handleLogin}
            size="large"
            status={error ? 'error' : undefined}
          />
        </div>
        {error && <Typography.Text type="danger">{error}</Typography.Text>}
      </Modal>
      <AdminAuthProvider logout={logout}>
        {authenticated && children}
      </AdminAuthProvider>
    </>
  )
}
