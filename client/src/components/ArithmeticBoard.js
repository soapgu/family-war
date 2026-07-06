import { useState, useEffect, useRef, useCallback } from 'react'
import { Typography, Button, Input, Space } from 'antd'
import useSocket from '../hooks/useSocket'
import MatchResult from './MatchResult'

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

function getAudioCtx(audioCtxRef) {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtxRef.current.state === 'suspended') {
    audioCtxRef.current.resume()
  }
  return audioCtxRef.current
}

function playQuestionSfx(audioCtxRef) {
  const ctx = getAudioCtx(audioCtxRef)
  const now = ctx.currentTime
  for (const [freq, t] of [[587, 0], [784, 0.1]]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + t)
    gain.gain.setValueAtTime(0, now + t)
    gain.gain.linearRampToValueAtTime(0.15, now + t + 0.02)
    gain.gain.linearRampToValueAtTime(0, now + t + 0.08)
    osc.start(now + t); osc.stop(now + t + 0.08)
  }
}

function playCorrectSfx(audioCtxRef) {
  const ctx = getAudioCtx(audioCtxRef)
  const now = ctx.currentTime
  for (const [freq, t] of [[523, 0], [659, 0.12], [784, 0.24]]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + t)
    gain.gain.setValueAtTime(0, now + t)
    gain.gain.linearRampToValueAtTime(0.18, now + t + 0.02)
    gain.gain.linearRampToValueAtTime(0, now + t + 0.12)
    osc.start(now + t); osc.stop(now + t + 0.12)
  }
}

function playWrongSfx(audioCtxRef) {
  const ctx = getAudioCtx(audioCtxRef)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3)
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
}

function playRobotSfx(audioCtxRef) {
  const ctx = getAudioCtx(audioCtxRef)
  const now = ctx.currentTime
  for (const [freq, t] of [[880, 0], [660, 0.08]]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, now + t)
    gain.gain.setValueAtTime(0, now + t)
    gain.gain.linearRampToValueAtTime(0.1, now + t + 0.01)
    gain.gain.linearRampToValueAtTime(0, now + t + 0.06)
    osc.start(now + t); osc.stop(now + t + 0.06)
  }
}

function ArithmeticBoard({ gameInfo, onFinish }) {
  const socket = useSocket()
  const [players, setPlayers] = useState(gameInfo?.players || [])
  const [scoreMap, setScoreMap] = useState(() => {
    if (gameInfo?.players) {
      const initial = {}
      gameInfo.players.forEach((p) => { initial[p.id] = 0 })
      return initial
    }
    return {}
  })
  const [question, setQuestion] = useState(gameInfo?.firstQuestion || null)
  const [feedback, setFeedback] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
  const [matchResult, setMatchResult] = useState(null)
  const [wrongThisRound, setWrongThisRound] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const prevQuestionId = useRef(null)
  const onFinishRef = useRef(onFinish)
  const audioCtxRef = useRef(null)

  useEffect(() => {
    onFinishRef.current = onFinish
  })

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
    if (gameInfo?.firstQuestion) {
      const fq = gameInfo.firstQuestion
      prevQuestionId.current = fq.questionId
      playQuestionSfx(audioCtxRef)
      startTimer()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [])

  useEffect(() => {
    function onGameStart(data) {
      const initial = {}
      data.players.forEach((p) => { initial[p.id] = 0 })
      setPlayers(data.players)
      setScoreMap(initial)
      setWrongThisRound(false)
      if (data.firstQuestion) {
        prevQuestionId.current = data.firstQuestion.questionId
        setQuestion(data.firstQuestion)
        startTimer()
        setTimeout(() => inputRef.current?.focus(), 100)
      } else {
        setQuestion(null)
      }
      setFeedback(null)
      setMatchResult(null)
    }

    function onQuestion(data) {
      if (data.questionId === prevQuestionId.current) return
      prevQuestionId.current = data.questionId
      playQuestionSfx(audioCtxRef)
      setWrongThisRound(false)
      setQuestion(data)
      setFeedback(null)
      setSubmitting(false)
      setAnswered(false)
      setInputValue('')
      startTimer()
      setTimeout(() => inputRef.current?.focus(), 100)
    }

    function onRoundResult(data) {
      clearTimer()
      setSubmitting(false)
      setAnswered(false)
      setFeedback({
        correct: data.yourAnswer === data.correctAnswer,
        correctAnswer: data.correctAnswer,
        expression: data.expression,
        yourAnswer: data.yourAnswer,
      })
      setScoreMap((prev) => ({ ...prev, ...data.scores }))

      if (data.yourAnswer === data.correctAnswer) {
        playCorrectSfx(audioCtxRef)
      } else if (data.winner === '__robot__') {
        playRobotSfx(audioCtxRef)
      }
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

    function onAnswerAck(data) {
      setSubmitting(false)
      if (!data.correct) {
        playWrongSfx(audioCtxRef)
        setWrongThisRound(true)
        setAnswered(true)
        setFeedback((prev) => {
          if (prev) return prev
          return {
            correct: false,
            correctAnswer: data.correctAnswer,
            expression: data.expression,
            yourAnswer: data.yourAnswer,
          }
        })
      }
    }

    socket.on('game:start', onGameStart)
    socket.on('game:question', onQuestion)
    socket.on('game:roundResult', onRoundResult)
    socket.on('game:matchResult', onMatchResult)
    socket.on('game:cancelled', onCancelled)
    socket.on('game:answerAck', onAnswerAck)

    return () => {
      socket.off('game:start', onGameStart)
      socket.off('game:question', onQuestion)
      socket.off('game:roundResult', onRoundResult)
      socket.off('game:matchResult', onMatchResult)
      socket.off('game:cancelled', onCancelled)
      socket.off('game:answerAck', onAnswerAck)
      clearTimer()
    }
  }, [socket, startTimer, clearTimer])

  function handleSubmit() {
    if (!question || submitting || answered) return
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
  const maxScore = ranking.length > 0 ? ranking[0].score : 0

  if (matchResult) {
    return (
      <MatchResult
        visible={true}
        gameType="arithmetic"
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

      {/* Leaderboard Grid */}
      <div style={{ maxWidth: 420, margin: '0 auto 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranking.map((p) => {
            const isRobot = p.id === '__robot__'
            const isMe = p.id === socket.id
            const isLeading = p.score === maxScore && maxScore > 0
            const isActive = !!question && !feedback
            const rank = ranking.findIndex((r) => r.id === p.id)
            const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : ''
            const cellSize = 28, cellGap = 3

            let emotion
            if (isRobot && isActive) {
              emotion = timeLeft <= 5 ? '💡' : '🤔'
            } else if (isMe && wrongThisRound) {
              emotion = '😭'
            } else if (isLeading) {
              emotion = '😊'
            } else {
              emotion = '😰'
            }

            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 8,
                background: isLeading ? '#f6ffed' : 'transparent',
              }}>
                <span style={{ width: 28, textAlign: 'center', fontSize: 22 }}>{medal}</span>
                <span style={{ width: 22, textAlign: 'center', fontSize: 22 }}>
                  {ROLE_EMOJI[p.role]}
                </span>
                <span style={{ width: 44, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.nickname}
                </span>
                <div style={{ position: 'relative', width: 5 * cellSize + 4 * cellGap, height: cellSize, flexShrink: 0 }}>
                  {[0, 1, 2, 3, 4].map((ci) => (
                    <div key={ci} style={{
                      position: 'absolute', left: ci * (cellSize + cellGap),
                      width: cellSize, height: cellSize, borderRadius: 4,
                      background: ci < p.score ? '#1677ff' : '#f0f0f0',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                  {p.score > 0 && (
                    <span style={{
                      position: 'absolute', left: 0, top: 0,
                      width: cellSize, height: cellSize,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                      transform: `translateX(${(p.score - 1) * (cellSize + cellGap)}px)`,
                      transition: 'transform 0.3s ease',
                    }}>
                      {ROLE_EMOJI[p.role]}
                    </span>
                  )}
                </div>
                <span style={{
                  width: 26, textAlign: 'center', fontSize: 22,
                  animation: emotion === '💡' ? 'bulbUrgent 0.4s ease-in-out infinite' : emotion === '🤔' ? 'thinkingPulse 1.5s ease-in-out infinite' : 'none',
                  flexShrink: 0,
                }}>
                  {emotion}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#666', width: 30, textAlign: 'right' }}>
                  {p.score}分
                </span>
              </div>
            )
          })}
        </div>
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
              disabled={submitting || !!feedback || answered}
              style={{ textAlign: 'center', fontSize: 18, fontWeight: 600 }}
            />
            <Button
              type="primary"
              size="large"
              onClick={handleSubmit}
              loading={submitting}
              disabled={!inputValue || !!feedback || submitting || answered}
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
    </div>
  )
}

export default ArithmeticBoard
