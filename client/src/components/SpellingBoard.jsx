import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Image, Input, Space, Tag, Typography } from 'antd'
import { SoundOutlined } from '@ant-design/icons'
import useSocket from '../hooks/useSocket'
import MatchResult from './MatchResult'

const ROUND_TIME = 20
const SPEECH_RESTART_DELAY = 50
const PUBLIC_BASE = import.meta.env.DEV
  ? ''
  : (import.meta.env.BASE_URL || '').replace(/\/$/, '')

const ROLE_EMOJI = {
  '爸爸': '👨',
  '妈妈': '👩',
  '儿子': '👦',
  '机器人': '🤖',
}

const DIFFICULTY_LABELS = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
}

function resolveImageUrl(url) {
  if (!url) return ''
  return url.startsWith('/api/') ? `${PUBLIC_BASE}${url}` : url
}

function playFeedbackTone(audioRef, correct) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return
  if (!audioRef.current) audioRef.current = new AudioContextClass()
  const ctx = audioRef.current
  if (ctx.state === 'suspended') ctx.resume()
  const now = ctx.currentTime
  const frequencies = correct ? [660, 880] : [330, 220]
  frequencies.forEach((frequency, index) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(frequency, now + index * 0.08)
    gain.gain.setValueAtTime(0.1, now + index * 0.08)
    gain.gain.linearRampToValueAtTime(0, now + index * 0.08 + 0.1)
    osc.start(now + index * 0.08)
    osc.stop(now + index * 0.08 + 0.1)
  })
}

function SpellingBoard({ gameInfo, onFinish }) {
  const socket = useSocket()
  const [players, setPlayers] = useState(gameInfo?.players || [])
  const [scoreMap, setScoreMap] = useState(() => Object.fromEntries(
    (gameInfo?.players || []).map((player) => [player.id, 0])
  ))
  const [difficulty, setDifficulty] = useState(gameInfo?.difficulty || 'easy')
  const [question, setQuestion] = useState(gameInfo?.firstQuestion || null)
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
  const [matchResult, setMatchResult] = useState(null)
  const [imageError, setImageError] = useState(false)
  const timerRef = useRef(null)
  const inputRef = useRef(null)
  const prevQuestionId = useRef(null)
  const onFinishRef = useRef(onFinish)
  const voiceRef = useRef(null)
  const utteranceRef = useRef(null)
  const speechTimerRef = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => {
    onFinishRef.current = onFinish
  })

  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) return undefined
    const loadVoices = () => {
      const voices = synth.getVoices?.() || []
      voiceRef.current = voices.find((voice) => /Google UK English/.test(voice.name))
        || voices.find((voice) => /Daniel|Kate/.test(voice.name))
        || voices.find((voice) => voice.lang?.startsWith('en-GB'))
        || voices.find((voice) => voice.lang?.startsWith('en'))
        || null
    }
    if (synth.getVoices) {
      loadVoices()
      synth.addEventListener?.('voiceschanged', loadVoices)
    }
    return () => synth.removeEventListener?.('voiceschanged', loadVoices)
  }, [])

  const cancelSpeech = useCallback(() => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current)
      speechTimerRef.current = null
    }
    utteranceRef.current = null
    window.speechSynthesis?.cancel?.()
  }, [])

  const speak = useCallback((text) => {
    const synth = window.speechSynthesis
    if (!text || !synth?.speak || typeof SpeechSynthesisUtterance === 'undefined') return
    cancelSpeech()
    synth.resume?.()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-GB'
    utterance.rate = 0.8
    if (voiceRef.current) utterance.voice = voiceRef.current
    utteranceRef.current = utterance
    const release = () => {
      if (utteranceRef.current === utterance) utteranceRef.current = null
    }
    utterance.onend = release
    utterance.onerror = release
    speechTimerRef.current = setTimeout(() => {
      speechTimerRef.current = null
      if (utteranceRef.current === utterance) synth.speak(utterance)
    }, SPEECH_RESTART_DELAY)
  }, [cancelSpeech])

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
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return current - 1
      })
    }, 1000)
  }, [clearTimer])

  const showQuestion = useCallback((nextQuestion) => {
    if (!nextQuestion || nextQuestion.questionId === prevQuestionId.current) return
    prevQuestionId.current = nextQuestion.questionId
    setQuestion(nextQuestion)
    setInputValue('')
    setSubmitting(false)
    setAnswered(false)
    setFeedback(null)
    setImageError(false)
    startTimer()
    speak(nextQuestion.ttsText)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [speak, startTimer])

  useEffect(() => {
    showQuestion(gameInfo?.firstQuestion)
  }, [])

  useEffect(() => {
    function onGameStart(data) {
      if (data.gameType !== 'spelling') return
      setPlayers(data.players)
      setScoreMap(Object.fromEntries(data.players.map((player) => [player.id, 0])))
      setDifficulty(data.difficulty || 'easy')
      setMatchResult(null)
      prevQuestionId.current = null
      showQuestion(data.firstQuestion)
    }

    function onQuestion(data) {
      showQuestion(data)
    }

    function onAnswerAck(data) {
      if (data.questionId !== prevQuestionId.current || data.correct) return
      setSubmitting(false)
      setAnswered(true)
      setFeedback({
        correct: false,
        correctAnswer: data.correctAnswer,
        yourAnswer: data.yourAnswer,
      })
      playFeedbackTone(audioRef, false)
    }

    function onRoundResult(data) {
      if (data.gameType !== 'spelling') return
      clearTimer()
      setSubmitting(false)
      setAnswered(true)
      setScoreMap((current) => ({ ...current, ...data.scores }))
      const correct = data.winner === socket.id
      setFeedback({
        correct,
        correctAnswer: data.correctAnswer,
        yourAnswer: data.yourAnswer,
        winner: data.winner,
      })
      playFeedbackTone(audioRef, correct)
    }

    function onMatchResult(data) {
      if (data.gameType !== 'spelling') return
      clearTimer()
      setSubmitting(false)
      setQuestion(null)
      setMatchResult(data)
      cancelSpeech()
    }

    function onCancelled() {
      clearTimer()
      cancelSpeech()
      onFinishRef.current()
    }

    socket.on('game:start', onGameStart)
    socket.on('game:question', onQuestion)
    socket.on('game:answerAck', onAnswerAck)
    socket.on('game:roundResult', onRoundResult)
    socket.on('game:matchResult', onMatchResult)
    socket.on('game:cancelled', onCancelled)
    return () => {
      socket.off('game:start', onGameStart)
      socket.off('game:question', onQuestion)
      socket.off('game:answerAck', onAnswerAck)
      socket.off('game:roundResult', onRoundResult)
      socket.off('game:matchResult', onMatchResult)
      socket.off('game:cancelled', onCancelled)
      clearTimer()
      cancelSpeech()
      audioRef.current?.close?.()
      audioRef.current = null
    }
  }, [socket, cancelSpeech, clearTimer, showQuestion])

  function handleSubmit() {
    const answer = inputValue.trim()
    if (!question || !answer || submitting || answered) return
    setSubmitting(true)
    socket.emit('game:answer', { questionId: question.questionId, answer })
  }

  const ranking = Object.entries(scoreMap)
    .sort(([, a], [, b]) => b - a)
    .map(([id, score]) => {
      const player = players.find((item) => item.id === id)
      return { id, nickname: player?.nickname || id, role: player?.role, score }
    })

  if (matchResult) {
    return (
      <MatchResult
        visible={true}
        gameType="spelling"
        matchWinner={matchResult.matchWinner}
        scores={matchResult.scores}
        ranking={matchResult.ranking}
        history={[]}
        myId={socket.id}
        onBack={onFinish}
        onRematch={() => socket.emit('game:challenge', { mode: 'spelling' })}
      />
    )
  }

  const imageUrl = resolveImageUrl(question?.unsplashImageUrl)

  return (
    <div className="spelling-board">
      <div className="spelling-board-title">
        <Typography.Title level={3} style={{ margin: 0 }}>🔤 爱拼才会赢</Typography.Title>
        <Tag color="blue">{DIFFICULTY_LABELS[difficulty] || difficulty}</Tag>
      </div>

      <div className="spelling-ranking">
        {ranking.map((player, index) => (
          <div className={`spelling-player${index === 0 && player.score > 0 ? ' is-leading' : ''}`} key={player.id}>
            <span className="spelling-player-role">{ROLE_EMOJI[player.role] || '🙂'}</span>
            <span className="spelling-player-name">{player.nickname}</span>
            <div className="spelling-score-track">
              {[0, 1, 2, 3, 4].map((score) => (
                <span className={score < player.score ? 'is-scored' : ''} key={score} />
              ))}
            </div>
            <strong>{player.score}分</strong>
          </div>
        ))}
      </div>

      {question ? (
        <div className="spelling-question-card">
          <div className="spelling-question-meta">
            <Typography.Text type="secondary">第 {question.round} 题</Typography.Text>
            <Button
              icon={<SoundOutlined />}
              onClick={() => speak(question.ttsText)}
              disabled={!question.ttsText}
            >
              再听一次
            </Button>
          </div>

          <div className="spelling-clue">
            {imageUrl && !imageError ? (
              <Image
                src={imageUrl}
                alt="单词提示图"
                preview={false}
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="spelling-image-placeholder">暂无图片提示</div>
            )}
          </div>

          <div className="spelling-blanks" aria-label={`填空 ${question.blanks}`}>
            {question.blanks.split(' ').map((token, index) => (
              token === '·' ? (
                <span className="spelling-word-gap" key={`${token}-${index}`}>·</span>
              ) : (
                <span className={`spelling-letter${token === '_' ? '' : ' is-visible'}`} key={`${token}-${index}`}>
                  {token}
                </span>
              )
            ))}
          </div>

          <Space.Compact className="spelling-answer">
            <Input
              ref={inputRef}
              size="large"
              placeholder="输入完整单词"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
              disabled={submitting || answered}
              autoComplete="off"
            />
            <Button
              type="primary"
              size="large"
              onClick={handleSubmit}
              loading={submitting}
              disabled={!inputValue.trim() || submitting || answered}
            >
              提交
            </Button>
          </Space.Compact>

          <div className="spelling-timer">
            <div style={{ width: `${(timeLeft / ROUND_TIME) * 100}%` }} />
          </div>
          <Typography.Text className={timeLeft <= 5 ? 'spelling-time is-urgent' : 'spelling-time'}>
            ⏱️ {timeLeft}s
          </Typography.Text>

          {feedback && (
            <div className={`spelling-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`}>
              <strong>{feedback.correct ? '✅ 拼写正确！' : '❌ 本题未答对'}</strong>
              {!feedback.correct && (
                <span>正确答案：{feedback.correctAnswer}，你的答案：{feedback.yourAnswer || '未作答'}</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <Typography.Text type="secondary">等待题目…</Typography.Text>
      )}
    </div>
  )
}

export default SpellingBoard
