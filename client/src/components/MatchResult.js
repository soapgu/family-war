import { Modal, Typography, Button, Space } from 'antd'

const CHOICE_LABEL = { rock: '✊', paper: '✋', scissors: '✌️' }

function RoundHistory({ history, myId }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
      {history.map((h, i) => {
        const myMove = h.moves[myId]
        const oppId = Object.keys(h.moves).find((id) => id !== myId)
        const oppMove = h.moves[oppId]
        const isDraw = h.winner === 'draw'
        const iWon = h.winner === myId
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '6px 12px',
              background: isDraw ? '#fffbe6' : iWon ? '#f6ffed' : '#fff2f0',
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            <span>第{i + 1}局</span>
            <span>{CHOICE_LABEL[myMove]}</span>
            <span style={{ color: '#999' }}>vs</span>
            <span>{CHOICE_LABEL[oppMove]}</span>
            <span style={{ fontWeight: 600, color: isDraw ? '#faad14' : iWon ? '#52c41a' : '#ff4d4f' }}>
              {isDraw ? '平局' : iWon ? '胜' : '负'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function MatchResult({ visible, matchWinner, scores, history, myId, onBack, onRematch }) {
  const iWon = matchWinner === myId

  return (
    <Modal
      open={visible}
      closable={false}
      footer={null}
      centered
      width={380}
    >
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>
          {iWon ? '🏆' : '😢'}
        </div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {iWon ? '恭喜你获得比赛胜利！' : '比赛结束，下次加油！'}
        </Typography.Title>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 32,
            margin: '20px 0',
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          <span style={{ color: '#52c41a' }}>我 {scores[myId] || 0}</span>
          <span style={{ color: '#999' }}>:</span>
          <span style={{ color: '#ff4d4f' }}>
            {Object.entries(scores).find(([id]) => id !== myId)?.[1] || 0}
          </span>
        </div>

        <RoundHistory history={history} myId={myId} />

        <Space size="middle">
          <Button onClick={onBack} size="large">
            返回房间
          </Button>
          <Button type="primary" size="large" onClick={onRematch}>
            再来一局
          </Button>
        </Space>
      </div>
    </Modal>
  )
}

export default MatchResult
