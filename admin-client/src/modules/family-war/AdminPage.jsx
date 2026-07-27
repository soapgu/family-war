import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Button, Tag, Card, Space } from 'antd'
import { ReloadOutlined, LogoutOutlined } from '@ant-design/icons'
import { useAdminAuth } from '../../auth/AdminAuthContext'
import PageHeader from '../../components/PageHeader'
import RequestState from '../../components/RequestState'
import { ApiRequestError } from '../../config/request'
import { familyWarAdminApi } from './api'

const ROLE_EMOJI = {
  '爸爸': '👨',
  '妈妈': '👩',
  '儿子': '👦',
  '机器人': '🤖',
}

function AdminPage() {
  const navigate = useNavigate()
  const { logout, expireSession } = useAdminAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStatus = useCallback(async () => {
    setError('')
    try {
      setData(await familyWarAdminApi.getStatus())
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        expireSession()
        return
      }
      setError(requestError instanceof ApiRequestError ? requestError.message : '获取后台状态失败')
    } finally {
      setLoading(false)
    }
  }, [expireSession])

  useEffect(() => {
    fetchStatus()
    const timer = setInterval(fetchStatus, 5000)
    return () => clearInterval(timer)
  }, [fetchStatus])

  const rooms = data?.rooms || []
  const matchHistory = data?.matchHistory || []

  async function handleLogout() {
    await logout()
  }

  return (
    <main className="platform-page">
      <PageHeader
        title="后台管理"
        description="查看 Family War 在线状态和历史对局。"
        breadcrumbs={[
          { title: '管理首页', path: '/' },
          { title: 'Family War' },
        ]}
        extra={[
          <Button key="word-config" onClick={() => navigate('/family-war/word-config')}>词库管理</Button>,
          <Button key="refresh" icon={<ReloadOutlined />} onClick={fetchStatus}>刷新</Button>,
          <Button key="logout" icon={<LogoutOutlined />} onClick={handleLogout} danger>登出</Button>,
        ]}
      />

      {loading && !data && (
        <RequestState state="loading" description="正在加载 Family War 状态…" />
      )}
      {error && (
        <RequestState
          state="error"
          title="后台状态加载失败"
          description={error}
          onRetry={fetchStatus}
        />
      )}
      {data && (
        <>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <Card size="small" style={{ flex: 1 }}><Typography.Text strong>在线房间</Typography.Text><div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{rooms.length}</div></Card>
        <Card size="small" style={{ flex: 1 }}><Typography.Text strong>在线玩家</Typography.Text><div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{rooms.reduce((s, r) => s + r.players.length, 0)}</div></Card>
        <Card size="small" style={{ flex: 1 }}><Typography.Text strong>历史对局</Typography.Text><div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{matchHistory.length}</div></Card>
      </div>

      {/* Rooms */}
      <Typography.Title level={5} style={{ marginBottom: 12 }}>📡 房间状态</Typography.Title>
      {rooms.length === 0 && (
        <RequestState state="empty" title="暂无活跃房间" description="有玩家进入房间后会显示在这里。" />
      )}
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
      {matchHistory.length === 0 && (
        <RequestState state="empty" title="暂无对局记录" description="完成比赛后会显示历史结果。" />
      )}
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
        </>
      )}
    </main>
  )
}

export default AdminPage
