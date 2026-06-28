import { Typography, Input, Button, Space } from 'antd'

function Home() {
  return (
    <div style={{ maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
      <Typography.Title level={2}>Family War</Typography.Title>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input placeholder="输入昵称" size="large" />
        <Button type="primary" size="large" block>
          进入房间
        </Button>
      </Space>
    </div>
  )
}

export default Home
