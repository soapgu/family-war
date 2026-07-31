import { useState, useEffect, useMemo, useRef } from 'react'
import { Typography, Button, Tag, Space, Segmented, App } from 'antd'
import useSocket from '../hooks/useSocket'
import RoleCard from '../components/RoleCard'
import GameBoard from '../components/GameBoard'
import ArithmeticBoard from '../components/ArithmeticBoard'
import SpellingBoard from '../components/SpellingBoard'

const SPELLING_DIFFICULTIES = [
  { label: 'EASY', value: 'easy', icon: '🌱' },
  { label: 'NORMAL', value: 'normal', icon: '⚡' },
  { label: 'HARD', value: 'hard', icon: '🔥' },
]

function getAudioContext(audioCtxRef) {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtxRef.current.state === 'suspended') {
    audioCtxRef.current.resume()
  }
  return audioCtxRef.current
}

function playSfx(audioCtxRef, freqStart, freqEnd, duration = 0.12) {
  const ctx = getAudioContext(audioCtxRef)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freqStart, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration * 0.7)
  gain.gain.setValueAtTime(0.18, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

function playBattleSfx(audioCtxRef) {
  const ctx = getAudioContext(audioCtxRef)

  const osc1 = ctx.createOscillator()
  osc1.type = 'square'
  osc1.frequency.setValueAtTime(150, ctx.currentTime)
  osc1.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.12)
  osc1.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.22)

  const gain1 = ctx.createGain()
  gain1.gain.setValueAtTime(0, ctx.currentTime)
  gain1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02)
  gain1.gain.setValueAtTime(0.12, ctx.currentTime + 0.1)
  gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25)

  osc1.connect(gain1)
  gain1.connect(ctx.destination)

  const osc2 = ctx.createOscillator()
  osc2.type = 'sawtooth'
  osc2.frequency.setValueAtTime(300, ctx.currentTime)
  osc2.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.12)
  osc2.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.22)

  const gain2 = ctx.createGain()
  gain2.gain.setValueAtTime(0, ctx.currentTime)
  gain2.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.02)
  gain2.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.1)
  gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25)

  osc2.connect(gain2)
  gain2.connect(ctx.destination)

  osc1.start(ctx.currentTime)
  osc1.stop(ctx.currentTime + 0.25)
  osc2.start(ctx.currentTime)
  osc2.stop(ctx.currentTime + 0.25)
}

const ROLES = ['爸爸', '妈妈', '儿子', '机器人']

const ROLE_EMOJI = {
  '爸爸': '👨',
  '妈妈': '👩',
  '儿子': '👦',
  '机器人': '🤖',
}

const ROLE_COLORS = {
  '爸爸': '#1677ff',
  '妈妈': '#eb2f96',
  '儿子': '#52c41a',
  '机器人': '#722ed1',
}

function Room({ nickname, roomState, onBack, onReturnToRoom }) {
  const socket = useSocket()
  const { message } = App.useApp()
  const [gameInfo, setGameInfo] = useState(null)
  const [gameKey, setGameKey] = useState(0)
  const audioCtxRef = useRef(null)
  const prevSocketIdRef = useRef(socket.id)
  const me = useMemo(() => roomState?.players.find((p) => p.id === socket.id), [roomState, socket.id])
  const myRole = me?.role || null
  const playerList = useMemo(() => roomState?.players || [], [roomState])
  const humanCount = useMemo(
    () => playerList.filter((p) => p.id !== '__robot__').length,
    [playerList]
  )

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
      setGameKey((k) => k + 1)
    }
    function onGameCancelled({ message: msg }) {
      message.info(msg || '比赛已取消')
      setGameInfo(null)
    }
    function onError({ message: msg }) {
      message.error(msg)
    }

    socket.on('player:joined', onJoined)
    socket.on('player:left', onLeft)
    socket.on('game:start', onGameStart)
    socket.on('game:cancelled', onGameCancelled)
    socket.on('game:error', onError)
    return () => {
      socket.off('player:joined', onJoined)
      socket.off('player:left', onLeft)
      socket.off('game:start', onGameStart)
      socket.off('game:cancelled', onGameCancelled)
      socket.off('game:error', onError)
    }
  }, [socket, roomState])

  useEffect(() => {
    if (!roomState) return

    const isReconnect = prevSocketIdRef.current !== socket.id
    prevSocketIdRef.current = socket.id

    // 正常结束由 game:forfeited / game:cancelled / onFinish 各自控制 UI 时序；
    // 这里只在 Socket 身份变化时兜底清理旧面板，避免 room.game 清空抢先吞掉对手提示。
    if (gameInfo && isReconnect) {
      setGameInfo(null)
      setGameKey((k) => k + 1)
    }
  }, [roomState])

  function handleRoleClick(role) {
    if (role === '机器人') return
    if (myRole === role) {
      playSfx(audioCtxRef, 587, 440)
      socket.emit('role:deselect')
    } else if (!roomState?.roles[role]) {
      playSfx(audioCtxRef, 523, 659)
      socket.emit('role:select', { role })
    }
  }

  function handleLeave() {
    socket.emit('room:leave')
    onBack()
  }

  function handleReturnToRoom() {
    setGameInfo(null)
    onReturnToRoom?.()
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
                <Tag data-testid="room-online-count" style={{ marginLeft: 8 }}>
                  {humanCount} 人在线
                </Tag>
            </Typography.Text>
          </div>
          <Space>
            {!gameInfo && (
              <Button onClick={onBack} ghost size="small">
                返回首页
              </Button>
            )}
            <Button onClick={handleLeave} danger ghost size="small" data-testid="room-leave-btn">
              退出房间
            </Button>
          </Space>
        </div>

        {gameInfo ? (
          gameInfo.gameType === 'spelling' ? (
            <SpellingBoard gameInfo={gameInfo} onFinish={handleReturnToRoom} />
          ) : gameInfo.gameType === 'arithmetic' ? (
            <ArithmeticBoard gameInfo={gameInfo} onFinish={handleReturnToRoom} />
          ) : (
            <GameBoard key={gameKey}
              nickname={nickname}
              myRole={myRole}
              opponent={gameInfo.opponent}
              onFinish={() => setGameInfo(null)}
              onReturnToRoom={onReturnToRoom}
            />
          )
        ) : (
          <>
            {/* Mode Selector */}
            <div style={{
              marginBottom: 18,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}>
              <Segmented
                data-testid="room-mode-segmented"
                value={roomState?.gameMode || 'rps'}
                options={[
                  { label: '✊ 猜拳', value: 'rps' },
                  { label: '🧮 算术', value: 'arithmetic' },
                  { label: '🔤 默写', value: 'spelling' },
                ]}
                onChange={(value) => socket.emit('game:setMode', value === 'spelling'
                  ? { mode: value, difficulty: roomState?.spellingDifficulty || 'easy' }
                  : { mode: value })}
              />
              {roomState?.gameMode === 'spelling' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  padding: '6px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.68)',
                  boxShadow: '0 8px 24px rgba(31,35,48,0.09)',
                  backdropFilter: 'blur(8px)',
                }}>
                  {SPELLING_DIFFICULTIES.map((item) => {
                    const active = (roomState?.spellingDifficulty || 'easy') === item.value
                    return (
                      <Button
                        key={item.value}
                        data-testid={`room-difficulty-${item.value}`}
                        aria-pressed={active}
                        type={active ? 'primary' : 'default'}
                        onClick={() => socket.emit('game:setMode', { mode: 'spelling', difficulty: item.value })}
                        style={{
                          height: 38,
                          minWidth: 98,
                          paddingInline: 12,
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 800,
                          letterSpacing: 0.5,
                          border: active ? '0' : '1px solid rgba(22,119,255,0.16)',
                          background: active
                            ? 'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)'
                            : 'rgba(255,255,255,0.78)',
                          color: active ? '#fff' : '#475569',
                          boxShadow: active
                            ? '0 10px 24px rgba(22,119,255,0.28)'
                            : '0 4px 12px rgba(31,35,48,0.06)',
                          transform: active ? 'translateY(-2px)' : 'translateY(0)',
                          transition: 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
                        }}
                      >
                        <span style={{ marginRight: 6 }}>{item.icon}</span>
                        {item.label}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Player List */}
            <div
              data-testid="room-player-list"
              style={{
                background: '#fafafa',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 24,
                border: '1px solid #f0f0f0',
              }}
            >
              <Typography.Text strong style={{ fontSize: 14 }}>
                在线玩家 ({humanCount})
              </Typography.Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {playerList.map((p) => (
                  <Tag
                    key={p.id}
                    data-testid="room-player"
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
              <div data-testid="room-role-required-message" style={{ marginTop: 20, textAlign: 'center', color: '#999' }}>
                选择一个角色加入游戏
              </div>
            )}

            {/* Challenge Section */}
            {myRole && (
              roomState?.gameMode === 'arithmetic' || roomState?.gameMode === 'spelling' ? (
                <div style={{ marginTop: 32, textAlign: 'center', animation: 'fadeInUp 0.4s ease' }}>
                  <Typography.Text strong style={{ fontSize: 15, display: 'block', marginBottom: 16 }}>
                    {roomState?.gameMode === 'spelling' ? '默写比赛 ✏️' : '算术比赛 🧮'}
                  </Typography.Text>
                  <Button
                    data-testid="room-start-match-btn"
                    type="primary"
                    size="large"
                    onClick={() => {
                      socket.emit('game:challenge', { mode: roomState?.gameMode })
                    }}
                    style={{
                      borderRadius: 8,
                      height: 46,
                      paddingInline: 32,
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  >
                    {roomState?.gameMode === 'spelling' ? '开始默写比赛' : '开始比赛'}
                  </Button>
                </div>
              ) : challengableRoles.length > 0 ? (
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
                          data-testid={`room-challenge-${role}`}
                          danger
                          size="large"
                          icon={<span style={{ fontSize: 18 }}>⚔️</span>}
                          onClick={() => {
                            playBattleSfx(audioCtxRef)
                            socket.emit('game:challenge', { targetId: target.id })
                          }}
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
              ) : null
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Room
