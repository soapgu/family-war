import { useState, useEffect } from 'react'
import { Typography, Input, Button, Space, message } from 'antd'
import useSocket from '../hooks/useSocket'

const APP_VERSION = '0.1.0'

const QUOTES = [
  { role: '爸爸', emoji: '👨', text: '谁输谁洗碗' },
  { role: '妈妈', emoji: '👩', text: '输了快滚去写作业' },
  { role: '儿子', emoji: '👦', text: '赢了可以玩游戏啦' },
]

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
          maxWidth: 420,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 16,
          padding: '40px 32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          textAlign: 'center',
          animation: 'fadeInUp 0.5s ease',
        }}
      >
        <div style={{ fontSize: 42, marginBottom: 12, letterSpacing: 6 }}>
          <span style={{ display: 'inline-block', transform: 'rotate(-8deg)' }}>✊</span>
          <span style={{ display: 'inline-block', transform: 'rotate(4deg)' }}>✋</span>
          <span style={{ display: 'inline-block', transform: 'rotate(8deg)' }}>✌️</span>
        </div>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Family War
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 15, display: 'block', marginTop: 4 }}>
          家庭猜拳大作战
        </Typography.Text>

        {/* Quotes */}
        <div
          style={{
            margin: '24px 0',
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #f0f5ff 0%, #fff0f6 100%)',
            borderRadius: 12,
            border: '1px solid #f0f0f0',
          }}
        >
          {QUOTES.map((q, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
                borderBottom: i < QUOTES.length - 1 ? '1px dashed #e8e8e8' : 'none',
              }}
            >
              <span style={{ fontSize: 24 }}>{q.emoji}</span>
              <span style={{ fontSize: 14, color: '#666', whiteSpace: 'nowrap' }}>{q.role}</span>
              <span style={{ fontSize: 15, color: '#333' }}>「{q.text}」</span>
            </div>
          ))}
        </div>

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
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
      <div style={{ position: 'fixed', bottom: 12, right: 16, fontSize: 11, color: '#666' }}>
        v{APP_VERSION}
      </div>
    </div>
  )
}

export default Home
