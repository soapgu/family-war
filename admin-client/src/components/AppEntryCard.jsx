import { Button, Card, Space, Typography } from 'antd'

export default function AppEntryCard({ app, onEnter }) {
  return (
    <Card title={app.name} className="admin-app-card">
      <Space direction="vertical">
        <Typography.Text>{app.description}</Typography.Text>
        <Button type="primary" onClick={() => onEnter(app.entryPath)}>
          进入管理
        </Button>
      </Space>
    </Card>
  )
}
