import { Card, Tag } from 'antd'

const ROLE_EMOJI = {
  '爸爸': '👨',
  '妈妈': '👩',
  '儿子': '👦',
}

const ROLE_COLORS = {
  '爸爸': { border: '#1677ff', bg: '#e6f4ff', shadow: 'rgba(22,119,255,0.25)' },
  '妈妈': { border: '#eb2f96', bg: '#fff0f6', shadow: 'rgba(235,47,150,0.25)' },
  '儿子': { border: '#52c41a', bg: '#f6ffed', shadow: 'rgba(82,196,26,0.25)' },
}

function RoleCard({ role, occupant, isMine, onClick }) {
  const isFree = !occupant
  const disabled = !isFree && !isMine
  const colors = ROLE_COLORS[role] || { border: '#1677ff', bg: '#e6f4ff', shadow: 'rgba(22,119,255,0.25)' }

  function handleClick() {
    if (disabled) return
    onClick(role)
  }

  return (
    <Card
      size="small"
      style={{
        position: 'relative',
        width: 180,
        textAlign: 'center',
        overflow: 'visible',
        borderTop: `4px solid ${colors.border}`,
        background: isMine ? colors.bg : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: isMine ? 'translateY(-8px)' : 'translateY(0)',
        transition: 'all 0.25s ease',
        opacity: disabled ? 0.5 : 1,
        boxShadow: isMine ? `0 6px 20px ${colors.shadow}` : '0 1px 4px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isMine) {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isMine) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
        }
      }}
    >
      <div onClick={handleClick} style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {/* Raised hand badge when selected */}
        {isMine && (
          <div
            style={{
              position: 'absolute',
              top: -14,
              right: -8,
              fontSize: 26,
              lineHeight: 1,
              animation: 'wave 1.2s ease-in-out infinite',
              transformOrigin: 'bottom center',
            }}
          >
            🙋
          </div>
        )}

        <div style={{ fontSize: 48, lineHeight: 1.2, marginTop: isMine ? 4 : 0 }}>
          {ROLE_EMOJI[role]}
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, margin: '6px 0 10px' }}>{role}</div>
        <div style={{ marginBottom: 4 }}>
          {isFree ? (
            <Tag>空闲</Tag>
          ) : (
            <Tag color={isMine ? 'blue' : 'default'}>{isMine ? '我' : occupant.nickname}</Tag>
          )}
        </div>
      </div>
    </Card>
  )
}

export default RoleCard
