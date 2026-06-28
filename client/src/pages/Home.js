import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Input, Button, Space, message } from 'antd'
import useSocket from '../hooks/useSocket'

function Home() {
  const [nickname, setNickname] = useState('')
  const navigate = useNavigate()
  const socket = useSocket()

  useEffect(() => {
    socket.on('room:state', () => navigate('/room'))
    return () => socket.off('room:state')
  }, [socket, navigate])

  function handleEnter() {
    if (!nickname.trim()) {
      message.error('请输入昵称')
      return
    }
    socket.emit('room:join', { nickname: nickname.trim() })
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
