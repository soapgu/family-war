import { useState } from 'react'
import { Typography, Input, Button, Space, message } from 'antd'

function Home({ onEnter }) {
  const [nickname, setNickname] = useState('')

  function handleEnter() {
    if (!nickname.trim()) {
      message.error('请输入昵称')
      return
    }
    onEnter(nickname.trim())
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleEnter()
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
      <Typography.Title level={2}>Family War</Typography.Title>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input
          placeholder="输入昵称"
          size="large"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button type="primary" size="large" block onClick={handleEnter}>
          进入房间
        </Button>
      </Space>
    </div>
  )
}

export default Home
