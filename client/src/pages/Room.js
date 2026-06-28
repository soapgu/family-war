import { useEffect, useMemo } from 'react'
import { Typography, Button, Tag, message } from 'antd'
import useSocket from '../hooks/useSocket'
import RoleCard from '../components/RoleCard'

const ROLES = ['爸爸', '妈妈', '儿子']

const ROLE_EMOJI = {
  '爸爸': '👨',
  '妈妈': '👩',
  '儿子': '👦',
}

const ROLE_COLORS = {
  '爸爸': '#1677ff',
  '妈妈': '#eb2f96',
  '儿子': '#52c41a',
}

function Room({ nickname, roomState, onBack }) {
  const socket = useSocket()
  const me = useMemo(() => roomState?.players.find((p) => p.id === socket.id), [roomState, socket.id])
  const myRole = me?.role || null
  const playerList = useMemo(() => roomState?.players || [], [roomState])

  useEffect(() => {
    function onJoined({ nickname: name }) {
      message.info(`${name} 加入了房间`)
    }
    function onLeft({ socketId }) {
      const p = roomState?.players.find((pl) => pl.id === socketId)
      message.info(`${p?.nickname || '有人'} 离开了房间`)
    }
    socket.on('player:joined', onJoined)
    socket.on('player:left', onLeft)
    return () => {
      socket.off('player:joined', onJoined)
      socket.off('player:left', onLeft)
    }
  }, [socket, roomState])

  function handleRoleClick(role) {
    if (myRole === role) {
      socket.emit('role:deselect')
    } else if (!roomState?.roles[role]) {
      socket.emit('role:select', { role })
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'rgba(255,255,255,0.92)',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              游戏房间
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              房间 ID: <Typography.Text code>default</Typography.Text>
              <Tag style={{ marginLeft: 8 }}>
                {playerList.length} 人在线
              </Tag>
            </Typography.Text>
          </div>
          <Button onClick={onBack} ghost>
            返回首页
          </Button>
        </div>

        {/* Player List */}
        <div
          style={{
            background: '#fafafa',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 24,
            border: '1px solid #f0f0f0',
          }}
        >
          <Typography.Text strong style={{ fontSize: 14 }}>
            在线玩家 ({playerList.length})
          </Typography.Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {playerList.map((p) => (
              <Tag
                key={p.id}
                color={p.role ? ROLE_COLORS[p.role] : 'default'}
                style={{ padding: '2px 10px', borderRadius: 12 }}
              >
                {p.role ? `${ROLE_EMOJI[p.role]} ${p.nickname}` : `🤷 ${p.nickname}`}
              </Tag>
            ))}
            {playerList.length === 0 && (
              <Typography.Text type="secondary">暂无其他玩家</Typography.Text>
            )}
          </div>
        </div>

        {/* Role Cards */}
        <Typography.Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
          选择角色
        </Typography.Text>
        <div data-testid="role-cards"
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {ROLES.map((role) => (
            <RoleCard
              key={role}
              role={role}
              occupant={roomState?.roles[role] || null}
              isMine={myRole === role}
              onClick={handleRoleClick}
            />
          ))}
        </div>

        {me && !myRole && (
          <div style={{ marginTop: 20, textAlign: 'center', color: '#999' }}>
            选择一个角色加入游戏
          </div>
        )}
      </div>
    </div>
  )
}

export default Room
