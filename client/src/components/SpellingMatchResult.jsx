import { Typography, Button, Space, Collapse, Tag } from 'antd'

const MEDAL = ['🥇', '🥈', '🥉']

function SpellingMatchResult({ matchWinner, ranking, history, myId, onBack, onRematch }) {
  const iWon = matchWinner === myId
  const winnerEntry = ranking.find((r) => r.playerId === matchWinner)
  const winnerName = winnerEntry?.nickname || matchWinner
  const playerMap = Object.fromEntries(ranking.map((r) => [r.playerId, r.nickname]))

  const collapseItems = history.map((item, index) => {
    const answers = Object.entries(item.answeredBy || {}).map(([id, answer]) => ({
      id,
      nickname: playerMap[id] || id,
      answer,
      correct: typeof answer === 'string' && answer.toLowerCase() === item.word.toLowerCase(),
    }))

    ranking.forEach((entry) => {
      if (item.answeredBy?.[entry.playerId] === undefined) {
        answers.push({ id: entry.playerId, nickname: entry.nickname, answer: null, correct: false })
      }
    })

    return {
      key: index,
      label: (
        <span>
          第 {item.round} 题
          <code style={{ margin: '0 8px', fontSize: 13 }}>{item.word}</code>
          <Tag color="green" style={{ margin: 0 }}>{playerMap[item.winner] || item.winner} 答对</Tag>
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 8, color: '#666' }}>填空提示：{item.blanks}</div>
          {answers.map((playerAnswer) => (
            <div key={playerAnswer.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              borderBottom: '1px solid #f5f5f5',
            }}>
              <span>
                {playerAnswer.nickname}
                {playerAnswer.id === myId && <Tag style={{ marginLeft: 6 }} color="blue">我</Tag>}
              </span>
              {playerAnswer.answer !== null ? (
                <span style={{ color: playerAnswer.correct ? '#52c41a' : '#ff4d4f', fontWeight: playerAnswer.correct ? 600 : 400 }}>
                  {playerAnswer.correct ? '✅ ' : '❌ '}{playerAnswer.answer}
                </span>
              ) : (
                <span style={{ color: '#999' }}>未作答</span>
              )}
            </div>
          ))}
        </div>
      ),
    }
  })

  return (
    <div data-testid="spelling-match-result" style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>{iWon ? '🏆' : '😢'}</div>
      <Typography.Title data-testid="spelling-match-result-title" level={4} style={{ margin: 0 }}>
        {iWon ? '恭喜你获得比赛胜利！' : `${winnerName} 获胜！`}
      </Typography.Title>

      <div data-testid="spelling-ranking" style={{
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
        {ranking.map((entry, index) => (
          <div key={entry.playerId} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: index < ranking.length - 1 ? '1px solid #f0f0f0' : 'none',
            background: entry.playerId === myId ? '#e6f7ff' : 'transparent',
            borderRadius: 6,
            paddingLeft: entry.playerId === myId ? 8 : 0,
            paddingRight: entry.playerId === myId ? 8 : 0,
          }}>
            <span>
              <span style={{ marginRight: 8, fontSize: 16 }}>{index < 3 ? MEDAL[index] : `${index + 1}.`}</span>
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
            🔤 单词回顾
          </Typography.Text>
          <Collapse items={collapseItems} size="small" bordered={false} style={{ background: 'transparent' }} />
        </div>
      )}

      <Space size="middle" style={{ marginTop: 8 }}>
        <Button data-testid="spelling-return-room-btn" onClick={onBack} size="large">返回房间</Button>
        <Button data-testid="spelling-rematch-btn" type="primary" size="large" onClick={onRematch}>再来一局</Button>
      </Space>
    </div>
  )
}

export default SpellingMatchResult
