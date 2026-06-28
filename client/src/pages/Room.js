import { useState, useEffect, useMemo } from 'react'
import { Typography, Button, Tag, message, Space } from 'antd'
import useSocket from '../hooks/useSocket'
import RoleCard from '../components/RoleCard'
import GameBoard from '../components/GameBoard'

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
  const [gameInfo, setGameInfo] = useState(null)
  const me = useMemo(() => roomState?.players.find((p) => p.id === socket.id), [roomState, socket.id])
  const myRole = me?.role || null
  const playerList = useMemo(() => roomState?.players || [], [roomState])

  const challengableRoles = useMemo(
    () => ROLES.filter((role) => {
      const occupant = roomState?.roles[role]
      return occupant && occupant.id !== socket.id
    }),
    [roomState, socket.id]
  )

  useEffect(() => {
    function onJoined({ nickname: name }) {
      message.info(`${name} 加入了房间`)
    }
    function onLeft({ socketId }) {
      const p = roomState?.players.find((pl) => pl.id === socketId)
      message.info(`${p?.nickname || '有人'} 离开了房间`)
    }
    function onGameStart(data) {
      setGameInfo(data)
    }
    function onGameCancelled({ message: msg }) {
      message.info(msg || '比赛已取消')
      setGameInfo(null)
    }
    function onMatchResult() {
      setGameInfo(null)
    }
    function onError({ message: msg }) {
      message.error(msg)
    }

    socket.on('player:joined', onJoined)
    socket.on('player:left', onLeft)
    socket.on('game:start', onGameStart)
    socket.on('game:cancelled', onGameCancelled)
    socket.on('game:matchResult', onMatchResult)
    socket.on('game:error', onError)
    return () => {
      socket.off('player:joined', onJoined)
      socket.off('player:left', onLeft)
      socket.off('game:start', onGameStart)
      socket.off('game:cancelled', onGameCancelled)
      socket.off('game:matchResult', onMatchResult)
      socket.off('game:error', onError)
    }
  }, [socket, roomState])

  function handleRoleClick(role) {
    if (myRole === role) {
      socket.emit('role:deselect')
    } else if (!roomState?.roles[role]) {
      socket.emit('role:select', { role })
    }
  }

  function handleLeave() {
    socket.emit('room:leave')
    onBack()
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
          <Space>
            <Button onClick={onBack} ghost size="small">
              返回首页
            </Button>
            <Button onClick={handleLeave} danger ghost size="small">
              退出房间
            </Button>
          </Space>
        </div>

        {gameInfo ? (
          <GameBoard
            nickname={nickname}
            myRole={myRole}
            opponent={gameInfo.opponent}
            round={gameInfo.round}
          />
        ) : (
          <>
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

            {/* Challenge Section */}
            {myRole && challengableRoles.length > 0 && (
              <div style={{ marginTop: 32, textAlign: 'center', animation: 'fadeInUp 0.4s ease' }}>
                <Typography.Text strong style={{ fontSize: 15, display: 'block', marginBottom: 16 }}>
                  发起挑战 ⚔️
                </Typography.Text>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {challengableRoles.map((role) => {
                    const target = roomState.roles[role]
                    return (
                      <Button
                        key={role}
                        danger
                        size="large"
                        icon={<span style={{ fontSize: 18 }}>⚔️</span>}
                        onClick={() => socket.emit('game:challenge', { targetId: target.id })}
                        style={{
                          borderRadius: 8,
                          height: 46,
                          paddingInline: 28,
                          fontSize: 16,
                          fontWeight: 600,
                          boxShadow: '0 0 0 0 rgba(255,77,79,0.4)',
                          animation: 'challengePulse 2s ease-in-out infinite',
                        }}
                      >
                        挑战 {ROLE_EMOJI[role]} {target.nickname}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Room
