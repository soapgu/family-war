import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Image, Tag, Typography } from 'antd'
import { SoundOutlined } from '@ant-design/icons'
import useSocket from '../hooks/useSocket'
import MatchResult from './MatchResult'
import ScoreboardPanel from './ScoreboardPanel'

const ROUND_TIME_MAP = { easy: 40, normal: 30, hard: 20 }
const SPEECH_RESTART_DELAY = 50
const AUTO_SPEECH_REPEAT_COUNT = 3
const AUTO_SPEECH_REPEAT_PAUSE = 450
const VOICE_LOAD_TIMEOUT = 1500
const PUBLIC_BASE = import.meta.env.DEV
  ? ''
  : (import.meta.env.BASE_URL || '').replace(/\/$/, '')

const DIFFICULTY_LABELS = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
}

function resolveImageUrl(url) {
  if (!url) return ''
  return url.startsWith('/api/') ? `${PUBLIC_BASE}${url}` : url
}

function getBlankCount(blanks = '') {
  return blanks.split(' ').filter((token) => token === '_').length
}

function splitBlankWords(blanks = '') {
  return blanks.split(' ').reduce((words, token) => {
    if (token === '·') {
      words.push([])
    } else {
      words[words.length - 1].push(token)
    }
    return words
  }, [[]]).filter((word) => word.length > 0)
}

function buildAnswer(blanks = '', letters = []) {
  let blankIndex = 0
  return blanks.split(' ').map((token) => {
    if (token === '·') return ' '
    if (token === '_') {
      const letter = letters[blankIndex] || ''
      blankIndex += 1
      return letter
    }
    return token
  }).join('').replace(/\s+/g, ' ').trim()
}

function getBlankCorrectLetters(blanks, correctAnswer) {
  let pos = 0
  const letters = []
  for (const token of blanks.split(' ')) {
    if (token === '_') {
      letters.push(correctAnswer[pos] || '')
      pos++
    } else if (token === '·') {
      pos++
    } else {
      pos += token.length
    }
  }
  return letters
}

function playTypeSfx(audioRef) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return
  if (!audioRef.current) audioRef.current = new AudioContextClass()
  const ctx = audioRef.current
  if (ctx.state === 'suspended') ctx.resume()
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1000, now)
  osc.frequency.linearRampToValueAtTime(1200, now + 0.03)
  gain.gain.setValueAtTime(0.04, now)
  gain.gain.linearRampToValueAtTime(0, now + 0.04)
  osc.start(now)
  osc.stop(now + 0.04)
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
  const roundTime = ROUND_TIME_MAP[difficulty] || 20
  const [question, setQuestion] = useState(gameInfo?.firstQuestion || null)
  const [letterValues, setLetterValues] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [timeLeft, setTimeLeft] = useState(roundTime)
  const [matchResult, setMatchResult] = useState(null)
  const [imageError, setImageError] = useState(false)
  const [voicesReady, setVoicesReady] = useState(false)
  const timerRef = useRef(null)
  const letterRefs = useRef([])
  const prevQuestionId = useRef(null)
  const onFinishRef = useRef(onFinish)
  const voiceRef = useRef(null)
  const utteranceRef = useRef(null)
  const speechTimerRef = useRef(null)
  const repeatTimerRef = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => {
    onFinishRef.current = onFinish
  })

  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) return undefined
    let fallbackTimer
    const loadVoices = () => {
      const voices = synth.getVoices?.() || []
      if (voices.length === 0) return false
      voiceRef.current = voices.find((voice) => /Google UK English/.test(voice.name))
        || voices.find((voice) => /Daniel|Kate/.test(voice.name))
        || voices.find((voice) => voice.lang?.startsWith('en-GB'))
        || voices.find((voice) => voice.lang?.startsWith('en'))
        || null
      clearTimeout(fallbackTimer)
      fallbackTimer = null
      synth.removeEventListener?.('voiceschanged', loadVoices)
      setVoicesReady(true)
      return true
    }
    if (synth.getVoices) {
      if (!loadVoices()) {
        synth.addEventListener?.('voiceschanged', loadVoices)
        fallbackTimer = setTimeout(() => setVoicesReady(true), VOICE_LOAD_TIMEOUT)
      }
    } else {
      setVoicesReady(true)
    }
    return () => {
      clearTimeout(fallbackTimer)
      synth.removeEventListener?.('voiceschanged', loadVoices)
    }
  }, [])

  const cancelSpeech = useCallback(() => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current)
      speechTimerRef.current = null
    }
    if (repeatTimerRef.current) {
      clearTimeout(repeatTimerRef.current)
      repeatTimerRef.current = null
    }
    utteranceRef.current = null
    window.speechSynthesis?.cancel?.()
  }, [])

  const speak = useCallback((text, repeatCount = 1) => {
    const synth = window.speechSynthesis
    if (!text || !synth?.speak || typeof SpeechSynthesisUtterance === 'undefined') return
    cancelSpeech()
    const playOnce = (remaining) => {
      synth.resume?.()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-GB'
      utterance.rate = 0.8
      if (voiceRef.current) utterance.voice = voiceRef.current
      utteranceRef.current = utterance
      const release = () => {
        if (utteranceRef.current === utterance) utteranceRef.current = null
      }
      utterance.onend = () => {
        release()
        if (remaining <= 1) return
        repeatTimerRef.current = setTimeout(() => {
          repeatTimerRef.current = null
          playOnce(remaining - 1)
        }, AUTO_SPEECH_REPEAT_PAUSE)
      }
      utterance.onerror = release
      speechTimerRef.current = setTimeout(() => {
        speechTimerRef.current = null
        if (utteranceRef.current === utterance) synth.speak(utterance)
      }, SPEECH_RESTART_DELAY)
    }
    playOnce(Math.max(1, repeatCount))
  }, [cancelSpeech])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    clearTimer()
    setTimeLeft(roundTime)
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
  }, [clearTimer, roundTime])

  const showQuestion = useCallback((nextQuestion) => {
    if (!nextQuestion || nextQuestion.questionId === prevQuestionId.current) return
    prevQuestionId.current = nextQuestion.questionId
    setQuestion(nextQuestion)
    setLetterValues(Array(getBlankCount(nextQuestion.blanks)).fill(''))
    setSubmitting(false)
    setAnswered(false)
    setFeedback(null)
    setImageError(false)
  }, [])

  useEffect(() => {
    showQuestion(gameInfo?.firstQuestion)
  }, [])

  useEffect(() => {
    if (!question?.questionId) return undefined
    startTimer()
    return clearTimer
  }, [question?.questionId, startTimer, clearTimer])

  useEffect(() => {
    if (!question?.questionId || answered || submitting) return undefined
    const focusTimer = setTimeout(() => letterRefs.current[0]?.focus(), 100)
    return () => clearTimeout(focusTimer)
  }, [question?.questionId, answered, submitting])

  useEffect(() => {
    if (!voicesReady || !question?.questionId || !question.ttsText) return undefined
    speak(question.ttsText, AUTO_SPEECH_REPEAT_COUNT)
    return cancelSpeech
  }, [voicesReady, question?.questionId, question?.ttsText, speak, cancelSpeech])

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
      if (correct) playFeedbackTone(audioRef, true)
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

  function handleSubmit(nextLetters = letterValues) {
    const answer = buildAnswer(question?.blanks, nextLetters)
    if (!question || !answer || submitting || answered) return
    setSubmitting(true)
    socket.emit('game:answer', { questionId: question.questionId, answer })
  }

  function updateLetters(nextLetters) {
    setLetterValues(nextLetters)
    if (nextLetters.length > 0 && nextLetters.every(Boolean)) {
      handleSubmit(nextLetters)
    }
  }

  function handleLetterChange(index, rawValue) {
    if (submitting || answered) return
    const letters = rawValue.replace(/\s/g, '').split('')
    if (letters.length === 0) {
      const nextLetters = [...letterValues]
      nextLetters[index] = ''
      setLetterValues(nextLetters)
      return
    }
    if (letters.some((letter) => !/^[a-z]$/i.test(letter))) {
      const nextLetters = [...letterValues]
      nextLetters[index] = ''
      setLetterValues(nextLetters)
      setTimeout(() => letterRefs.current[index]?.focus(), 0)
      return
    }

    playTypeSfx(audioRef)
    const nextLetters = [...letterValues]
    let cursor = index
    letters.forEach((letter) => {
      if (cursor < nextLetters.length) {
        nextLetters[cursor] = letter.toLowerCase()
        cursor += 1
      }
    })
    updateLetters(nextLetters)
    const nextEmptyIndex = nextLetters.findIndex((letter, letterIndex) => letterIndex >= index && !letter)
    if (nextEmptyIndex >= 0) {
      setTimeout(() => letterRefs.current[nextEmptyIndex]?.focus(), 0)
    }
  }

  function handleLetterKeyDown(index, event) {
    if (event.key === 'Backspace' && !letterValues[index] && index > 0) {
      event.preventDefault()
      const nextLetters = [...letterValues]
      nextLetters[index - 1] = ''
      setLetterValues(nextLetters)
      setTimeout(() => letterRefs.current[index - 1]?.focus(), 0)
    }
  }

  const ranking = Object.entries(scoreMap)
    .sort(([, a], [, b]) => b - a)
    .map(([id, score]) => {
      const player = players.find((item) => item.id === id)
      return { id, nickname: player?.nickname || id, role: player?.role, score }
    })
  const wrongPlayerIds = feedback && !feedback.correct ? [socket.id] : []

  if (matchResult) {
    return (
      <MatchResult
        visible={true}
        gameType="spelling"
        matchWinner={matchResult.matchWinner}
        scores={matchResult.scores}
        ranking={matchResult.ranking}
        history={matchResult.history}
        myId={socket.id}
        onBack={onFinish}
        onRematch={() => socket.emit('game:challenge', { mode: 'spelling' })}
      />
    )
  }

  const imageUrl = resolveImageUrl(question?.unsplashImageUrl)
  const correctLetters = feedback && question?.blanks
    ? getBlankCorrectLetters(question.blanks, feedback.correctAnswer)
    : []

  return (
    <div className="spelling-board">
      <div className="spelling-board-title">
        <Typography.Title level={3} style={{ margin: 0 }}>🔤 爱拼才会赢</Typography.Title>
        <Tag color="blue">{DIFFICULTY_LABELS[difficulty] || difficulty}</Tag>
      </div>

      <ScoreboardPanel
        players={ranking}
        timeLeft={timeLeft}
        isActive={!!question && !feedback}
        wrongPlayerIds={wrongPlayerIds}
      />

      {question ? (
        <div className="spelling-question-card">
          <div className="spelling-question-meta">
            <Typography.Text type="secondary">第 {question.round} 题</Typography.Text>
            <Button
              aria-label="再听一次"
              className="spelling-replay-button"
              icon={<SoundOutlined />}
              onClick={() => speak(question.ttsText)}
              disabled={!question.ttsText}
            />
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

          <div className="spelling-composer" aria-label={`填空 ${question.blanks}`}>
            {(() => {
              let blankIndex = 0
              return splitBlankWords(question.blanks).map((word, wordIndex) => (
                <span className="spelling-word-wrap" key={`${word.join('')}-${wordIndex}`}>
                  {wordIndex > 0 && <span className="spelling-word-gap" aria-hidden="true">·</span>}
                  <span className="spelling-word">
                    {word.map((token, tokenIndex) => {
                      if (token !== '_') {
                        return <span className="spelling-letter is-visible" key={`${token}-${tokenIndex}`}>{token}</span>
                      }
                      const currentIndex = blankIndex
                      blankIndex += 1

                      if (answered && feedback) {
                        const userLetter = letterValues[currentIndex] || ''
                        const correctLetter = correctLetters[currentIndex]
                        const correct = feedback.correct || userLetter === correctLetter

                        if (correct) {
                          return (
                            <span className="spelling-letter is-visible" key={`${token}-${tokenIndex}`}>
                              {correctLetter}
                            </span>
                          )
                        }

                        return (
                          <span className="spelling-letter-cell" key={`${token}-${tokenIndex}`}>
                            {userLetter && (
                              <span className="spelling-letter-hint">{userLetter}</span>
                            )}
                            <input
                              aria-label={`第 ${currentIndex + 1} 个空格`}
                              autoComplete="off"
                              className="spelling-letter-input is-correct"
                              disabled
                              inputMode="text"
                              maxLength={1}
                              readOnly
                              value={correctLetter}
                            />
                          </span>
                        )
                      }

                      return (
                        <span className="spelling-letter-cell" key={`${token}-${tokenIndex}`}>
                          <input
                            aria-label={`第 ${currentIndex + 1} 个空格`}
                            autoComplete="off"
                            className="spelling-letter-input"
                            disabled={submitting}
                            inputMode="text"
                            maxLength={1}
                            onChange={(event) => handleLetterChange(currentIndex, event.target.value)}
                            onKeyDown={(event) => handleLetterKeyDown(currentIndex, event)}
                            ref={(element) => { letterRefs.current[currentIndex] = element }}
                            value={letterValues[currentIndex] || ''}
                          />
                        </span>
                      )
                    })}
                  </span>
                </span>
              ))
            })()}
          </div>

          <div className="spelling-timer">
            <div style={{ width: `${(timeLeft / roundTime) * 100}%` }} />
          </div>
          <Typography.Text className={timeLeft <= 5 ? 'spelling-time is-urgent' : 'spelling-time'}>
            ⏱️ {timeLeft}s
          </Typography.Text>
        </div>
      ) : (
        <Typography.Text type="secondary">等待题目…</Typography.Text>
      )}
    </div>
  )
}

export default SpellingBoard
