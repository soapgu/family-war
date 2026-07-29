import { Typography, Button, Space, Collapse, Tag } from 'antd'

const MEDAL = ['🥇', '🥈', '🥉']

function ArithmeticMatchResult({ matchWinner, scores, ranking, history, myId, onBack, onRematch }) {
  const iWon = matchWinner === myId
  const winnerEntry = ranking.find((r) => r.playerId === matchWinner)
  const winnerName = winnerEntry?.nickname || matchWinner
  const playerMap = Object.fromEntries(ranking.map((r) => [r.playerId, r.nickname]))

  const collapseItems = history.map((h, idx) => {
    const playerAnswers = Object.entries(h.answeredBy).map(([id, answer]) => {
      const correct = answer === h.correctAnswer
      return { id, nickname: playerMap[id] || id, answer, correct, isWinner: id === h.winner }
    })

    ranking.forEach((r) => {
      if (h.answeredBy[r.playerId] === undefined) {
        playerAnswers.push({ id: r.playerId, nickname: r.nickname, answer: null, correct: false, isWinner: false })
      }
    })

    return {
      key: idx,
      label: (
        <span>
          第 {h.round} 题
          <code style={{ margin: '0 8px', fontSize: 13 }}>{h.expression} = {h.correctAnswer}</code>
          <Tag color="green" style={{ margin: 0 }}>{playerMap[h.winner] || h.winner} 答对</Tag>
        </span>
      ),
      children: (
        <div>
          {playerAnswers.map((pa) => (
            <div key={pa.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              borderBottom: '1px solid #f5f5f5',
            }}>
              <span>
                {pa.nickname}
                {pa.id === myId && <Tag style={{ marginLeft: 6 }} color="blue">我</Tag>}
              </span>
              <span>
                {pa.answer !== null ? (
                  <span style={{ color: pa.correct ? '#52c41a' : '#ff4d4f', fontWeight: pa.correct ? 600 : 400 }}>
                    {pa.correct ? '✅ ' : '❌ '}{pa.answer}
                  </span>
                ) : (
                  <span style={{ color: '#999' }}>—</span>
                )}
              </span>
            </div>
          ))}
        </div>
      ),
    }
  })

  return (
    <div data-testid="arithmetic-match-result" style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>
        {iWon ? '🏆' : '😢'}
      </div>
      <Typography.Title data-testid="arithmetic-match-result-title" level={4} style={{ margin: 0 }}>
        {iWon ? '恭喜你获得比赛胜利！' : `${winnerName} 获胜！`}
      </Typography.Title>

      <div data-testid="arithmetic-ranking" style={{
        background: '#fafafa',
        borderRadius: 12,
        border: '1px solid #f0f0f0',
        padding: 16,
        margin: '20px 0',
        textAlign: 'left',
      }}>
        <Typography.Text strong style={{ fontSize: 15, display: 'block', marginBottom: 12, textAlign: 'center' }}>
          📊 最终排名
        </Typography.Text>
        {ranking.map((entry, idx) => (
          <div key={entry.playerId} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: idx < ranking.length - 1 ? '1px solid #f0f0f0' : 'none',
            background: entry.playerId === myId ? '#e6f7ff' : 'transparent',
            borderRadius: 6,
            paddingLeft: entry.playerId === myId ? 8 : 0,
            paddingRight: entry.playerId === myId ? 8 : 0,
          }}>
            <span>
              <span style={{ marginRight: 8, fontSize: 16 }}>
                {idx < 3 ? MEDAL[idx] : `${idx + 1}.`}
              </span>
              {entry.nickname}
              {entry.playerId === myId && <Tag style={{ marginLeft: 6 }} color="blue">我</Tag>}
            </span>
            <Tag color="blue" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{entry.score}分</Tag>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div style={{ margin: '20px 0', textAlign: 'left' }}>
          <Typography.Text strong style={{ fontSize: 15, display: 'block', marginBottom: 12, textAlign: 'center' }}>
            📝 对局回顾
          </Typography.Text>
          <Collapse items={collapseItems} size="small" bordered={false} style={{ background: 'transparent' }} />
        </div>
      )}

      <Space size="middle" style={{ marginTop: 8 }}>
        <Button data-testid="arithmetic-return-room-btn" onClick={onBack} size="large">返回房间</Button>
        <Button data-testid="arithmetic-rematch-btn" type="primary" size="large" onClick={onRematch}>再来一局</Button>
      </Space>
    </div>
  )
}

export default ArithmeticMatchResult
