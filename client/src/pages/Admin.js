import { useState, useEffect, useCallback } from 'react'
import { Typography, Button, Tag, Card, Space } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

const ROLE_EMOJI = {
  '爸爸': '👨',
  '妈妈': '👩',
  '儿子': '👦',
  '机器人': '🤖',
}

function Admin() {
  const [data, setData] = useState({ rooms: [], matchHistory: [] })

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/status')
      if (res.ok) {
        setData(await res.json())
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const timer = setInterval(fetchStatus, 5000)
    return () => clearInterval(timer)
  }, [fetchStatus])

  const { rooms, matchHistory } = data

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>后台管理</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={fetchStatus}>刷新</Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <Card size="small" style={{ flex: 1 }}><Typography.Text strong>在线房间</Typography.Text><div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{rooms.length}</div></Card>
        <Card size="small" style={{ flex: 1 }}><Typography.Text strong>在线玩家</Typography.Text><div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{rooms.reduce((s, r) => s + r.players.length, 0)}</div></Card>
        <Card size="small" style={{ flex: 1 }}><Typography.Text strong>历史对局</Typography.Text><div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{matchHistory.length}</div></Card>
      </div>

      {/* Rooms */}
      <Typography.Title level={5} style={{ marginBottom: 12 }}>📡 房间状态</Typography.Title>
      {rooms.length === 0 && <Typography.Text type="secondary">暂无活跃房间</Typography.Text>}
      {rooms.map((room) => (
        <Card key={room.id} size="small" title={<span>📦 {room.id}</span>} extra={room.game?.status === 'playing' ? <Tag color="orange">对战中</Tag> : <Tag>空闲</Tag>} style={{ marginBottom: 8 }}>
          {room.players.map((p) => (
            <div key={p.nickname} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span>{p.role ? ROLE_EMOJI[p.role] : '🤷'}</span>
              <span>{p.nickname}</span>
              {p.role && <Tag style={{ fontSize: 12 }}>{p.role}</Tag>}
              <Tag color={p.online ? 'green' : 'default'}>{p.online ? '在线' : '离线'}</Tag>
            </div>
          ))}
        </Card>
      ))}

      {/* History */}
      <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>🏆 对局历史</Typography.Title>
      {matchHistory.length === 0 && <Typography.Text type="secondary">暂无对局记录</Typography.Text>}
      {[...matchHistory].reverse().map((m) => {
        const [a, b] = m.players
        return (
          <Card key={m.id} size="small" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <Space>
                <span style={{ fontWeight: 600 }}>{m.playerNames?.[a] || a}</span>
                <span style={{ color: '#999' }}>vs</span>
                <span style={{ fontWeight: 600 }}>{m.playerNames?.[b] || b}</span>
              </Space>
              <Space>
                <span>比分 <b>{m.scores[a]}</b> : <b>{m.scores[b]}</b></span>
                <Tag color={m.matchWinnerName ? 'green' : 'default'}>{m.matchWinnerName ? `胜者 ${m.matchWinnerName}` : '—'}</Tag>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{new Date(m.endedAt).toLocaleString()}</Typography.Text>
              </Space>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export default Admin
