const ROLE_EMOJI = {
  '爸爸': '👨',
  '妈妈': '👩',
  '儿子': '👦',
  '机器人': '🤖',
}

function ScoreboardPanel({
  players,
  timeLeft = 20,
  isActive = false,
  wrongPlayerIds = [],
  maxScore = 5,
}) {
  const topScore = players.length > 0 ? players[0].score : 0
  const wrongSet = new Set(wrongPlayerIds)
  const cellSize = 28
  const cellGap = 3
  const cellCount = maxScore + 1

  return (
    <div className="scoreboard-panel">
      {players.map((player, index) => {
        const isRobot = player.id === '__robot__'
        const isLeading = player.score === topScore && topScore > 0
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''
        const roleEmoji = ROLE_EMOJI[player.role] || '🙂'
        const safeScore = Math.max(0, Math.min(player.score, maxScore))

        let emotion
        let emotionClass = ''
        if (isRobot && isActive) {
          emotion = timeLeft <= 5 ? '💡' : '🤔'
          emotionClass = timeLeft <= 5 ? 'is-urgent' : 'is-thinking'
        } else if (wrongSet.has(player.id)) {
          emotion = '😭'
        } else if (isLeading) {
          emotion = '😊'
        } else {
          emotion = '😰'
        }

        return (
          <div className={`scoreboard-row${isLeading ? ' is-leading' : ''}`} key={player.id}>
            <span className="scoreboard-medal">{medal}</span>
            <span className="scoreboard-role">{roleEmoji}</span>
            <span className="scoreboard-name" title={player.nickname}>{player.nickname}</span>
            <div
              className="scoreboard-track"
              style={{ width: cellCount * cellSize + maxScore * cellGap }}
            >
              {Array.from({ length: cellCount }, (_, cellIndex) => (
                <span
                  className={[
                    cellIndex <= safeScore ? 'is-scored' : '',
                    cellIndex === safeScore ? 'is-current' : '',
                  ].filter(Boolean).join(' ')}
                  key={cellIndex}
                  style={{ left: cellIndex * (cellSize + cellGap) }}
                />
              ))}
              <span
                className="scoreboard-token"
                style={{ transform: `translateX(${safeScore * (cellSize + cellGap)}px)` }}
              >
                {roleEmoji}
              </span>
            </div>
            <span className={`scoreboard-emotion ${emotionClass}`.trim()}>
              {emotion}
            </span>
            <span className="scoreboard-score">{player.score}分</span>
          </div>
        )
      })}
    </div>
  )
}

export default ScoreboardPanel
