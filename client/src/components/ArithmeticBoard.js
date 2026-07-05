import { useState, useEffect, useRef, useCallback } from 'react'
import { Typography, Button, Input, Tag, Space } from 'antd'
import useSocket from '../hooks/useSocket'
import ArithmeticMatchResult from './ArithmeticMatchResult'

const ROUND_TIME = 20

const ROLE_EMOJI = {
  '爸爸': '👨',
  '妈妈': '👩',
  '儿子': '👦',
  '机器人': '🤖',
}

const ROLE_COLORS = {
  '爸爸': '#1677ff',
  '妈妈': '#eb2f96',
  '儿子': '#52c41a',
  '机器人': '#722ed1',
}

function ArithmeticBoard({ gameInfo, onFinish }) {
  const socket = useSocket()
  const [players, setPlayers] = useState(gameInfo?.players || [])
  const [scoreMap, setScoreMap] = useState({})
  const [question, setQuestion] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
  const [matchResult, setMatchResult] = useState(null)
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const prevQuestionId = useRef(null)
  const onFinishRef = useRef(onFinish)

  useEffect(() => {
    onFinishRef.current = onFinish
  })

  useEffect(() => {
    if (gameInfo?.players) {
      const initial = {}
      gameInfo.players.forEach((p) => { initial[p.id] = 0 })
      setScoreMap(initial)
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    clearTimer()
    setTimeLeft(ROUND_TIME)
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return t - 1
      })
    }, 1000)
  }, [clearTimer])

  useEffect(() => {
    function onGameStart(data) {
      const initial = {}
      data.players.forEach((p) => { initial[p.id] = 0 })
      setPlayers(data.players)
      setScoreMap(initial)
      setQuestion(null)
      setFeedback(null)
      setMatchResult(null)
    }

    function onQuestion(data) {
      if (data.questionId === prevQuestionId.current) return
      prevQuestionId.current = data.questionId
      setQuestion(data)
      setFeedback(null)
      setSubmitting(false)
      setInputValue('')
      startTimer()
      setTimeout(() => inputRef.current?.focus(), 100)
    }

    function onRoundResult(data) {
      clearTimer()
      setSubmitting(false)
      setFeedback({
        correct: data.yourAnswer === data.correctAnswer,
        correctAnswer: data.correctAnswer,
        expression: data.expression,
        yourAnswer: data.yourAnswer,
      })
      setScoreMap((prev) => ({ ...prev, ...data.scores }))
    }

    function onMatchResult(data) {
      clearTimer()
      setSubmitting(false)
      setFeedback(null)
      setQuestion(null)
      setMatchResult(data)
    }

    function onCancelled() {
      clearTimer()
      onFinishRef.current()
    }

    socket.on('game:start', onGameStart)
    socket.on('game:question', onQuestion)
    socket.on('game:roundResult', onRoundResult)
    socket.on('game:matchResult', onMatchResult)
    socket.on('game:cancelled', onCancelled)

    return () => {
      socket.off('game:start', onGameStart)
      socket.off('game:question', onQuestion)
      socket.off('game:roundResult', onRoundResult)
      socket.off('game:matchResult', onMatchResult)
      socket.off('game:cancelled', onCancelled)
      clearTimer()
    }
  }, [socket, startTimer, clearTimer])

  function handleSubmit() {
    if (!question || submitting) return
    const answer = parseInt(inputValue, 10)
    if (isNaN(answer)) return
    setSubmitting(true)
    socket.emit('game:answer', { questionId: question.questionId, answer })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  const ranking = Object.entries(scoreMap)
    .sort(([, a], [, b]) => b - a)
    .map(([id, score]) => {
      const p = players.find((pl) => pl.id === id)
      return { id, nickname: p?.nickname || id, role: p?.role, score }
    })

  if (matchResult) {
    return (
      <ArithmeticMatchResult
        matchWinner={matchResult.matchWinner}
        scores={matchResult.scores}
        ranking={matchResult.ranking}
        history={matchResult.history}
        myId={socket.id}
        onBack={onFinish}
        onRematch={() => socket.emit('game:challenge', { mode: 'arithmetic' })}
      />
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '24px' }}>
      <Typography.Title level={3} style={{ marginBottom: 8 }}>
        🧮 算术达人模式
      </Typography.Title>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {players.map((p) => (
          <Tag key={p.id} color={p.role ? ROLE_COLORS[p.role] : 'default'}>
            {p.role ? `${ROLE_EMOJI[p.role] || ''} ${p.nickname}` : p.nickname}: {scoreMap[p.id] || 0}分
          </Tag>
        ))}
      </div>

      {question ? (
        <div style={{
          background: '#fafafa',
          borderRadius: 12,
          border: '1px solid #f0f0f0',
          padding: '32px 24px',
          maxWidth: 400,
          margin: '0 auto 24px',
        }}>
          <Typography.Text type="secondary" style={{ fontSize: 14 }}>
            第 {question.round} 题
          </Typography.Text>
          <div style={{ fontSize: 32, fontWeight: 700, margin: '16px 0', fontFamily: 'monospace' }}>
            {question.expression} = ?
          </div>

          <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
            <Input
              ref={inputRef}
              size="large"
              placeholder="输入答案"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={submitting || !!feedback}
              style={{ textAlign: 'center', fontSize: 18, fontWeight: 600 }}
            />
            <Button
              type="primary"
              size="large"
              onClick={handleSubmit}
              loading={submitting}
              disabled={!inputValue || !!feedback}
            >
              提交
            </Button>
          </Space.Compact>

          <div style={{
            width: '100%',
            height: 6,
            background: '#f0f0f0',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 4,
          }}>
            <div style={{
              width: `${(timeLeft / ROUND_TIME) * 100}%`,
              height: '100%',
              background: timeLeft > 5 ? '#1677ff' : '#ff4d4f',
              borderRadius: 3,
              transition: 'width 1s linear',
            }} />
          </div>
          <Typography.Text style={{ fontSize: 13, color: timeLeft > 5 ? '#999' : '#ff4d4f' }}>
            ⏱️ {timeLeft}s
          </Typography.Text>

          {feedback && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: feedback.correct ? '#f6ffed' : '#fff2f0' }}>
              <Typography.Text style={{ fontSize: 18, color: feedback.correct ? '#52c41a' : '#ff4d4f' }}>
                {feedback.correct ? '✅ 正确！' : '❌ 错误'}
              </Typography.Text>
              {!feedback.correct && (
                <div style={{ marginTop: 4 }}>
                  <Typography.Text type="secondary">
                    {feedback.expression} = {feedback.correctAnswer}
                    {feedback.yourAnswer !== undefined
                      ? `，你的答案: ${feedback.yourAnswer}`
                      : '，你未作答'}
                  </Typography.Text>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '40px 0' }}>
          <Typography.Text type="secondary" style={{ fontSize: 16 }}>
            等待题目…
          </Typography.Text>
        </div>
      )}

      {ranking.length > 0 && (
        <div style={{
          background: '#fafafa',
          borderRadius: 12,
          border: '1px solid #f0f0f0',
          padding: 16,
          maxWidth: 400,
          margin: '0 auto',
        }}>
          <Typography.Text strong style={{ fontSize: 15, display: 'block', marginBottom: 12 }}>
            📊 排行榜
          </Typography.Text>
          {ranking.map((entry, idx) => (
            <div key={entry.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 0',
              borderBottom: idx < ranking.length - 1 ? '1px solid #f0f0f0' : 'none',
            }}>
              <span>
                <span style={{ marginRight: 8 }}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                </span>
                {entry.role ? `${ROLE_EMOJI[entry.role] || ''} ${entry.nickname}` : entry.nickname}
              </span>
              <Tag color="blue" style={{ margin: 0 }}>{entry.score}分</Tag>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ArithmeticBoard
