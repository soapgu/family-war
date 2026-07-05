import { Typography, Button, Space } from 'antd'

function ArithmeticMatchResult({ matchWinner, scores, ranking, history, myId, onBack, onRematch }) {
  const iWon = matchWinner === myId

  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>
        {iWon ? '🏆' : '😢'}
      </div>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {iWon ? '恭喜你获得比赛胜利！' : '比赛结束，下次加油！'}
      </Typography.Title>

      <div style={{ margin: '20px 0' }}>
        <Typography.Text type="secondary">
          算术完整结算界面在 Phase 3 实现
        </Typography.Text>
      </div>

      <Space size="middle">
        <Button onClick={onBack} size="large">
          返回房间
        </Button>
        <Button type="primary" size="large" onClick={onRematch}>
          再来一局
        </Button>
      </Space>
    </div>
  )
}

export default ArithmeticMatchResult
