import { useEffect } from 'react'
import { Typography } from 'antd'
import useSocket from '../hooks/useSocket'

function ArithmeticBoard({ onFinish }) {
  const socket = useSocket()

  useEffect(() => {
    function onMatchResult() {
      onFinish()
    }
    function onCancelled() {
      onFinish()
    }

    socket.on('game:matchResult', onMatchResult)
    socket.on('game:cancelled', onCancelled)
    return () => {
      socket.off('game:matchResult', onMatchResult)
      socket.off('game:cancelled', onCancelled)
    }
  }, [socket, onFinish])

  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <Typography.Title level={3} style={{ marginBottom: 16 }}>
        🧮 算术达人模式
      </Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 16 }}>
        题目即将到来…<br />
        <span style={{ fontSize: 14 }}>完整游戏界面在 Phase 3 实现</span>
      </Typography.Text>
    </div>
  )
}

export default ArithmeticBoard
