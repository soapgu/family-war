import { Card, Button, Tag } from 'antd'

function RoleCard({ role, occupant, isMine, onClick }) {
  const isFree = !occupant
  const disabled = !isFree && !isMine

  function handleClick() {
    if (disabled) return
    onClick(role)
  }

  return (
    <Card
      title={role}
      size="small"
      style={{ width: 160, textAlign: 'center' }}
      extra={isMine ? <Tag color="blue">我</Tag> : null}
    >
      <div style={{ marginBottom: 12 }}>
        {isFree ? <Tag>空闲</Tag> : <Tag color="green">{occupant.nickname}</Tag>}
      </div>
      <Button
        type={isFree ? 'primary' : 'default'}
        block
        disabled={disabled}
        onClick={handleClick}
      >
        {isFree ? '选择' : isMine ? '放弃' : '已占用'}
      </Button>
    </Card>
  )
}

export default RoleCard
