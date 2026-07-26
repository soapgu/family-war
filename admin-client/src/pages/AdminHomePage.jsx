import { Empty, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { appRegistry } from '../app/appRegistry'
import AppEntryCard from '../components/AppEntryCard'

export default function AdminHomePage({ apps = appRegistry }) {
  const navigate = useNavigate()

  return (
    <main className="admin-home">
      <Typography.Title level={2}>管理首页</Typography.Title>
      <Typography.Paragraph type="secondary">
        选择需要管理的应用。
      </Typography.Paragraph>
      {apps.length > 0 ? (
        apps.map((app) => (
          <AppEntryCard key={app.id} app={app} onEnter={navigate} />
        ))
      ) : (
        <Empty description="暂无可管理应用" />
      )}
    </main>
  )
}
