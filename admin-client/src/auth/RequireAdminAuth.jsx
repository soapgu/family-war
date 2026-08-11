import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Modal, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { ApiRequestError } from '../config/request'
import { adminAuthApi } from './api'
import { AdminAuthProvider } from './AdminAuthContext'

export default function RequireAdminAuth({ children }) {
  const [authenticated, setAuthenticated] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const expireSession = useCallback(() => {
    setAuthenticated(false)
    setShowLogin(true)
  }, [])

  const logout = useCallback(async () => {
    try {
      await adminAuthApi.logout()
    } catch {
      // 即使服务端退出失败，也清理前端认证状态并要求重新登录。
    }
    expireSession()
  }, [expireSession])

  useEffect(() => {
    let active = true

    async function checkAuth() {
      try {
        await adminAuthApi.getCurrentAdmin()
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
      await adminAuthApi.login(password)
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
        mask={{ closable: false }}
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
      <AdminAuthProvider logout={logout} expireSession={expireSession}>
        {authenticated && children}
      </AdminAuthProvider>
    </>
  )
}
