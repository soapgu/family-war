import { Typography, Space, Button } from 'antd'
import useSocket from '../hooks/useSocket'
import RoleCard from '../components/RoleCard'

const ROLES = ['爸爸', '妈妈', '儿子']

function Room({ nickname, roomState, onBack }) {
  const socket = useSocket()
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

      {me && !myRole && (
        <div style={{ marginTop: 16, color: '#999' }}>
          选择一个角色加入游戏
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Button onClick={onBack}>返回首页</Button>
      </div>
    </div>
  )
}

export default Room
