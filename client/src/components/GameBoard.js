import { Typography } from 'antd'

const ROLE_EMOJI = {
  '爸爸': '👨',
  '妈妈': '👩',
  '儿子': '👦',
}

function GameBoard({ nickname, myRole, opponent, round }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 0', animation: 'fadeInUp 0.4s ease' }}>
      <Typography.Title level={4} style={{ marginBottom: 32 }}>
        第 {round}/3 回合
      </Typography.Title>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 24,
          marginBottom: 40,
          flexWrap: 'wrap',
        }}
      >
        {/* Me */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56 }}>{ROLE_EMOJI[myRole]}</div>
          <div style={{ fontWeight: 600, marginTop: 8, fontSize: 16 }}>{nickname}</div>
          <div style={{ fontSize: 13, color: '#999' }}>{myRole}</div>
        </div>

        <div style={{ fontSize: 32, color: '#d9d9d9' }}>⚔️</div>

        {/* Opponent */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56 }}>{ROLE_EMOJI[opponent.role]}</div>
          <div style={{ fontWeight: 600, marginTop: 8, fontSize: 16 }}>{opponent.nickname}</div>
          <div style={{ fontSize: 13, color: '#999' }}>{opponent.role}</div>
        </div>
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 15 }}>
        等待对手出拳...
      </Typography.Text>
    </div>
  )
}

export default GameBoard
