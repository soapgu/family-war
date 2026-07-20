import { useState, useEffect, useRef, useCallback } from 'react'
import { Typography, Button, Input, Space } from 'antd'
import useSocket from '../hooks/useSocket'
import MatchResult from './MatchResult'
import ScoreboardPanel from './ScoreboardPanel'

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
  const [timeLeft, setTimeLeft] = useState(20)
  const [matchResult, setMatchResult] = useState(null)
  const [wrongThisRound, setWrongThisRound] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const roundTimeRef = useRef(20)
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

  const startTimer = useCallback((timeLimitSec) => {
    roundTimeRef.current = timeLimitSec
    clearTimer()
    setTimeLeft(timeLimitSec)
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
      startTimer((gameInfo.timeLimitMs || 20000) / 1000)
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
        setInputValue('')
        setSubmitting(false)
        setAnswered(false)
        startTimer((data.timeLimitMs || 20000) / 1000)
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
      startTimer((data.timeLimitMs || 20000) / 1000)
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

      <ScoreboardPanel
        players={ranking}
        timeLeft={timeLeft}
        isActive={!!question && !feedback}
        wrongPlayerIds={wrongThisRound ? [socket.id] : []}
      />

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
              width: `${(timeLeft / (roundTimeRef.current || 20)) * 100}%`,
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
