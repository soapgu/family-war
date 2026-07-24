import { Layout, Menu, Typography } from 'antd'
import { AppstoreOutlined, ControlOutlined } from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const navigationItems = [
  { key: '/', icon: <AppstoreOutlined />, label: '管理首页' },
  { key: '/family-war', icon: <ControlOutlined />, label: 'Family War' },
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const selectedKey = location.pathname.startsWith('/family-war') ? '/family-war' : '/'

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
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Header>
      <Layout.Content className="admin-content">
        <Outlet />
      </Layout.Content>
    </Layout>
  )
}
