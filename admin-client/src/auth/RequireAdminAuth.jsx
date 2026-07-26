import { useEffect, useState } from 'react'
import { Button, Input, Modal, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { familyWarAdminApi } from '../modules/family-war/api'
import { ApiRequestError } from '../config/request'
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
        await familyWarAdminApi.getStatus()
        if (!active) return
        setAuthenticated(true)
        setShowLogin(false)
      } catch (requestError) {
        if (!active) return
        setAuthenticated(false)
        setShowLogin(true)
        if (requestError instanceof ApiRequestError && requestError.status !== 401) {
          setError(requestError.message)
        }
      }
    }

    checkAuth()
    return () => { active = false }
  }, [])

  async function handleLogin() {
    setLoading(true)
    setError('')
    try {
      await familyWarAdminApi.login(password)
      setAuthenticated(true)
      setShowLogin(false)
      setPassword('')
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : '登录请求失败')
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
