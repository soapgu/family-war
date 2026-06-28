import { useState, useEffect } from 'react'
import { Typography, Input, Button, Space, message } from 'antd'
import useSocket from '../hooks/useSocket'

function Home({ onEnter }) {
  const socket = useSocket()
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    function handleError({ message: msg }) {
      message.error(msg)
      setLoading(false)
    }
    socket.on('game:error', handleError)
    return () => socket.off('game:error', handleError)
  }, [socket])

  function handleEnter() {
    if (!nickname.trim()) {
      message.error('请输入昵称')
      return
    }
    setLoading(true)
    onEnter(nickname.trim())
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleEnter()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 16,
          padding: 40,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          textAlign: 'center',
          animation: 'fadeInUp 0.5s ease',
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 8 }}>🎮</div>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Family War
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 15 }}>
          家庭猜拳大作战
        </Typography.Text>
        <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 32 }}>
          <Input
            placeholder="输入昵称"
            size="large"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            variant="outlined"
            style={{ borderRadius: 8, height: 44 }}
          />
          <Button
            type="primary"
            size="large"
            block
            onClick={handleEnter}
            loading={loading}
            style={{ borderRadius: 8, height: 44, fontSize: 16 }}
          >
            进入房间
          </Button>
        </Space>
      </div>
    </div>
  )
}

export default Home
