import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Typography, Space, Spin, Button } from 'antd'
import useSocket from '../hooks/useSocket'
import RoleCard from '../components/RoleCard'

const ROLES = ['爸爸', '妈妈', '儿子']

function Room() {
  const socket = useSocket()
  const location = useLocation()
  const navigate = useNavigate()
  const hasInitialState = useRef(Boolean(location.state?.roomState))
  const [roomState, setRoomState] = useState(location.state?.roomState || null)

  useEffect(() => {
    if (!hasInitialState.current) {
      var timer = setTimeout(() => navigate('/'), 3000)
    }

    const handler = (state) => {
      if (timer) clearTimeout(timer)
      setRoomState(state)
    }
    socket.on('room:state', handler)

    return () => {
      socket.off('room:state', handler)
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const me = roomState?.players.find((p) => p.id === socket.id)
  const myRole = me?.role || null

  function handleRoleClick(role) {
    if (myRole === role) {
      socket.emit('role:deselect')
    } else if (!roomState?.roles[role]) {
      socket.emit('role:select', { role })
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <Typography.Title level={3}>游戏房间</Typography.Title>
      <Typography.Text type="secondary">
        房间 ID: <Typography.Text code>default</Typography.Text>
      </Typography.Text>

      <div style={{ marginTop: 24 }}>
        <Space size="large">
          {ROLES.map((role) => (
            <RoleCard
              key={role}
              role={role}
              occupant={roomState?.roles[role] || null}
              isMine={myRole === role}
              onClick={handleRoleClick}
            />
          ))}
        </Space>
      </div>

      {!roomState && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Spin />
          <div style={{ marginTop: 8, marginBottom: 16, color: '#999' }}>
            未加入房间，3秒后自动跳转...
          </div>
          <Button onClick={() => navigate('/')}>返回首页</Button>
        </div>
      )}

      {me && !myRole && (
        <div style={{ marginTop: 16, color: '#999' }}>
          选择一个角色加入游戏
        </div>
      )}
    </div>
  )
}

export default Room
