import { Layout, Menu, Typography } from 'antd'
import { AppstoreOutlined, ControlOutlined } from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { appRegistry } from '../app/appRegistry'

const iconByName = {
  control: <ControlOutlined />,
}

export const navigationItems = [
  { key: '/', icon: <AppstoreOutlined />, label: '管理首页' },
  ...appRegistry.map((app) => ({
    key: app.entryPath,
    icon: iconByName[app.icon],
    label: app.navigationLabel,
  })),
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const selectedApp = appRegistry.find((app) => (
    location.pathname === app.routePrefix
    || location.pathname.startsWith(`${app.routePrefix}/`)
  ))
  const selectedKey = location.pathname === '/' ? '/' : selectedApp?.entryPath

  return (
    <Layout className="admin-layout">
      <Layout.Header className="admin-header">
        <Typography.Title level={4} className="admin-brand">
          管理平台
        </Typography.Title>
        <Menu
          className="admin-navigation"
          theme="dark"
          mode="horizontal"
          items={navigationItems}
          selectedKeys={selectedKey ? [selectedKey] : []}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Header>
      <Layout.Content className="admin-content">
        <Outlet />
      </Layout.Content>
    </Layout>
  )
}
