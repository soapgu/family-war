import { Typography, Card, Space } from 'antd'

function Room() {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <Typography.Title level={3}>游戏房间</Typography.Title>
      <Typography.Text type="secondary">
        房间 ID: <Typography.Text code>default</Typography.Text>
      </Typography.Text>
      <div style={{ marginTop: 24 }}>
        <Space size="large">
          <Card title="爸爸" style={{ width: 160 }}>空闲</Card>
          <Card title="妈妈" style={{ width: 160 }}>空闲</Card>
          <Card title="儿子" style={{ width: 160 }}>空闲</Card>
        </Space>
      </div>
    </div>
  )
}

export default Room
