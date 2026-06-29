import { useState, useEffect, useMemo, useRef } from 'react'
import { Typography, Button, Space } from 'antd'
import useSocket from '../hooks/useSocket'
import MatchResult from './MatchResult'

const ROLE_EMOJI = {
  '爸爸': '👨',
  '妈妈': '👩',
  '儿子': '👦',
  '机器人': '🤖',
}

const CHOICES = [
  { key: 'rock', emoji: '✊', label: '石头' },
  { key: 'paper', emoji: '✋', label: '布' },
  { key: 'scissors', emoji: '✌️', label: '剪刀' },
]

const CHOICE_LABEL = { rock: '✊', paper: '✋', scissors: '✌️' }

const RESULT_EMOJI = { win: '🎉', lose: '😢', draw: '🤝' }
const RESULT_TEXT = { win: '你赢了！', lose: '你输了', draw: '平局！' }
const RESULT_COLOR = { win: '#52c41a', lose: '#ff4d4f', draw: '#faad14' }
const RESULT_BG = { win: '#f6ffed', lose: '#fff2f0', draw: '#fffbe6' }
const RESULT_BORDER = { win: '#b7eb8f', lose: '#ffccc7', draw: '#ffe58f' }

function RoundResultBanner({ winType, myMove, oppMove, myScore, oppScore, myName, oppName }) {
  const [animStage, setAnimStage] = useState('idle')
  const isWin = winType === 'win'
  const isDraw = winType === 'draw'
  const [myX, setMyX] = useState(-320)
  const [oppX, setOppX] = useState(320)

  useEffect(() => {
    const t1 = requestAnimationFrame(() => {
      setAnimStage('rush')
      setMyX(-30)
      setOppX(30)
    })
    const t2 = setTimeout(() => setAnimStage('clash'), 700)
    const t3 = setTimeout(() => {
      setAnimStage('result')
      if (isWin) setOppX(320)
      else if (isDraw) { setMyX(-75); setOppX(75) }
      else setMyX(-320)
    }, 900)
    return () => { cancelAnimationFrame(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  function getTransition() {
    if (animStage === 'idle') return 'none'
    if (animStage === 'result') return 'transform 0.2s cubic-bezier(0.36,1.68,0.56,1)'
    return 'transform 0.7s cubic-bezier(0.22,1.4,0.36,1)'
  }

  function fist(emoji, x, isWinner) {
    const inner = isWinner
      ? { display: 'inline-block', fontSize: 64, lineHeight: 1, animation: 'victoryPop 0.15s cubic-bezier(0.34,1.56,0.64,1) both' }
      : { display: 'inline-block', fontSize: 64, lineHeight: 1, transform: `translateX(${x}px)`, transition: getTransition() }
    return (
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
        <span style={inner}>{emoji}</span>
      </div>
    )
  }

  return (
    <div style={{ background: RESULT_BG[winType], border: `2px solid ${RESULT_BORDER[winType]}`, borderRadius: 14, padding: '16px 20px 18px', marginBottom: 20, overflow: 'hidden' }}>
      {/* Arena */}
      <div style={{ position: 'relative', height: 110, overflow: 'hidden' }}>
        {animStage === 'clash' && (
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: 40, zIndex: 10, animation: 'bounceIn 0.25s ease forwards' }}>
            💥
          </div>
        )}
        {animStage === 'result' && isWin
          ? fist(CHOICE_LABEL[myMove], myX, true)
          : fist(CHOICE_LABEL[myMove], myX, false)}
        {animStage === 'result' && !isWin && !isDraw
          ? fist(CHOICE_LABEL[oppMove], oppX, true)
          : fist(CHOICE_LABEL[oppMove], oppX, false)}
      </div>

      {/* Result text — delayed until after animation */}
      <div style={{ textAlign: 'center', marginTop: animStage === 'result' ? 4 : 0 }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: RESULT_COLOR[winType], opacity: animStage === 'result' ? 1 : 0, transition: 'opacity 0.3s ease 0.4s' }}>
          {RESULT_EMOJI[winType]} {RESULT_TEXT[winType]}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6, fontSize: 14, color: '#666', opacity: animStage === 'result' ? 1 : 0, transition: 'opacity 0.3s ease 0.5s' }}>
          <span style={{ fontWeight: 600, color: RESULT_COLOR[winType] }}>{myName}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: RESULT_COLOR[winType], animation: animStage === 'result' ? 'scorePop 0.4s ease 0.5s' : 'none' }}>{myScore}</span>
          <span>:</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{oppScore}</span>
          <span style={{ fontWeight: 600 }}>{oppName}</span>
        </div>
      </div>
    </div>
  )
}

function GameBoard({ nickname, myRole, opponent, onFinish }) {
  const socket = useSocket()
  const [myMove, setMyMove] = useState(null)
  const [oppMove, setOppMove] = useState(null)
  const [round, setRound] = useState(1)
  const [phase, setPhase] = useState('choosing') // choosing | waiting | roundResult | matchResult | forfeited
  const [resultMsg, setResultMsg] = useState('')
  const [winner, setWinner] = useState(null)
  const [scores, setScores] = useState({})
  const [matchResult, setMatchResult] = useState(null) // { matchWinner, scores, history }
  const [mySid, setMySid] = useState(null)
  const [forfeitMsg, setForfeitMsg] = useState('')

  const myId = useMemo(() => mySid || socket.id, [mySid, socket.id])
  const roundTimer = useRef(null)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  useEffect(() => {
    setMySid(socket.id)
  }, [socket.id])

  useEffect(() => {
    function onWaiting() {
      setPhase('waiting')
    }

    function onRoundResult(data) {
      clearTimeout(roundTimer.current)
      setMyMove(data.yourMove)
      setOppMove(data.oppMove)
      setWinner(data.winner)
      setScores(data.scores)
      setRound(data.round + 1)

      const iWon = data.winner === socket.id
      const isDraw = data.winner === 'draw'
      setResultMsg(isDraw ? '平局！' : iWon ? '你赢了这一局！' : '你输了这一局')
      setPhase('roundResult')

      roundTimer.current = setTimeout(() => {
        setMyMove(null)
        setOppMove(null)
        setWinner(null)
        setResultMsg('')
        setPhase('choosing')
      }, 2200)
    }

    function onMatchResult(data) {
      clearTimeout(roundTimer.current)
      const lastRound = data.history[data.history.length - 1]
      const lastMyMove = lastRound.moves[socket.id]
      const oppId = Object.keys(lastRound.moves).find((id) => id !== socket.id)
      const lastOppMove = lastRound.moves[oppId]

      setMyMove(lastMyMove)
      setOppMove(lastOppMove)
      setWinner(lastRound.winner)
      setScores(data.scores)
      setPhase('roundResult')

      roundTimer.current = setTimeout(() => {
        setMatchResult(data)
        setPhase('matchResult')
      }, 2200)
    }

    function onForfeited({ message: msg }) {
      setForfeitMsg(msg || '对手认输了')
      setPhase('forfeited')
      setTimeout(() => onFinishRef.current(), 2000)
    }

    socket.on('game:waiting', onWaiting)
    socket.on('game:roundResult', onRoundResult)
    socket.on('game:matchResult', onMatchResult)
    socket.on('game:forfeited', onForfeited)
    return () => {
      clearTimeout(roundTimer.current)
      socket.off('game:waiting', onWaiting)
      socket.off('game:roundResult', onRoundResult)
      socket.off('game:matchResult', onMatchResult)
      socket.off('game:forfeited', onForfeited)
    }
  }, [socket])

  function handleChoice(key) {
    clearTimeout(roundTimer.current)
    setMyMove(key)
    setPhase('waiting')
    socket.emit('game:move', { choice: key })
  }

  function handleForfeit() {
    socket.emit('game:forfeit')
    onFinish()
  }

  function handleRematch() {
    socket.emit('game:rematch')
    setMatchResult(null)
    setMyMove(null)
    setOppMove(null)
    setScores({})
    setPhase('choosing')
    setRound(1)
  }

  function handleBackAfterMatch() {
    setMatchResult(null)
    onFinish()
  }

  const matchEnded = phase === 'matchResult' || phase === 'forfeited'

  return (
    <div style={{ textAlign: 'center', padding: '24px 0', animation: 'fadeInUp 0.4s ease' }}>
      {/* Round title */}
      {!matchEnded && (
        <Typography.Title level={4} style={{ marginBottom: 24 }}>
          第 {round} 局
        </Typography.Title>
      )}

      {/* Players */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          marginBottom: 28,
          flexWrap: 'wrap',
        }}
      >
        {/* Me */}
        <div style={{ textAlign: 'center', minWidth: 100 }}>
          <div style={{ fontSize: myMove ? 40 : 48, transition: 'font-size 0.3s' }}>
            {myMove ? CHOICE_LABEL[myMove] : ROLE_EMOJI[myRole]}
          </div>
          <div style={{ fontWeight: 600, marginTop: 4, fontSize: 15 }}>{nickname}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {myMove ? '已出拳' : myRole}
          </div>
          {scores[myId] !== undefined && (
            <div style={{ fontSize: 13, color: '#52c41a', fontWeight: 600, marginTop: 2 }}>
              {scores[myId]} 分
            </div>
          )}
        </div>

        <div style={{ fontSize: 28, color: '#d9d9d9' }}>⚔️</div>

        {/* Opponent */}
        <div style={{ textAlign: 'center', minWidth: 100 }}>
          <div style={{ fontSize: oppMove ? 40 : 48, transition: 'font-size 0.3s' }}>
            {oppMove ? CHOICE_LABEL[oppMove] : ROLE_EMOJI[opponent.role]}
          </div>
          <div style={{ fontWeight: 600, marginTop: 4, fontSize: 15 }}>{opponent.nickname}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {oppMove ? '已出拳' : opponent.role}
          </div>
          {scores[opponent.id] !== undefined && (
            <div style={{ fontSize: 13, color: '#ff4d4f', fontWeight: 600, marginTop: 2 }}>
              {scores[opponent.id]} 分
            </div>
          )}
        </div>
      </div>

      {/* Round result */}
      {phase === 'roundResult' && winner && (
        <RoundResultBanner
          winType={winner === 'draw' ? 'draw' : winner === myId ? 'win' : 'lose'}
          myMove={myMove}
          oppMove={oppMove}
          myScore={scores[myId]}
          oppScore={scores[opponent.id]}
          myName={nickname}
          oppName={opponent.nickname}
        />
      )}

      {/* Forfeit message */}
      {phase === 'forfeited' && (
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 12,
            color: '#52c41a',
            animation: 'fadeInUp 0.3s ease',
          }}
        >
          {forfeitMsg}
        </div>
      )}

      {/* Choice buttons */}
      {phase === 'choosing' && (
        <>
          <div
            style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            {CHOICES.map((c) => (
              <Button
                key={c.key}
                size="large"
                onClick={() => handleChoice(c.key)}
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 12,
                  fontSize: 36,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  transition: 'all 0.2s',
                  border: '2px solid #e8e8e8',
                  background: '#fafafa',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1677ff'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(22,119,255,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e8e8e8'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <span style={{ fontSize: 36 }}>{c.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{c.label}</span>
              </Button>
            ))}
          </div>

          <Button
            type="text"
            danger
            size="small"
            onClick={handleForfeit}
            style={{ opacity: 0.5 }}
          >
            认输退出
          </Button>
        </>
      )}

      {/* Waiting */}
      {phase === 'waiting' && (
        <Typography.Text type="secondary" style={{ fontSize: 15 }}>
          等待对手出拳...
        </Typography.Text>
      )}

      {/* Match result modal */}
      {phase === 'matchResult' && matchResult && (
        <MatchResult
          visible={true}
          matchWinner={matchResult.matchWinner}
          scores={matchResult.scores}
          history={matchResult.history}
          myId={myId}
          onBack={handleBackAfterMatch}
          onRematch={handleRematch}
        />
      )}
    </div>
  )
}

export default GameBoard
