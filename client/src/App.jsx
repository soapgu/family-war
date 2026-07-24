import { App as AntApp } from 'antd'
import { useState, useEffect, useRef } from 'react'
import useSocket from './hooks/useSocket'
import Home from './pages/Home'
import Room from './pages/Room'

const BASE_URL = import.meta.env.BASE_URL || ''
const BGM_LOBBY = BASE_URL + '/bgm.mp3'
const BGM_BATTLE = BASE_URL + '/bgm_battle.mp3'
const BGM_RESULT = BASE_URL + '/bgm_result.mp3'
const BGM_VOLUME = 0.3

function GameApp() {
  const socket = useSocket()
  const [nickname, setNickname] = useState('')
  const [roomState, setRoomState] = useState(null)
  const bgmRef = useRef(null)
  const prevBgmState = useRef(null)
  const savedNickname = useRef('')

  function startBgm(path) {
    if (bgmRef.current) bgmRef.current.pause()
    const audio = new Audio(path)
    audio.loop = true
    audio.volume = BGM_VOLUME
    audio.play().catch(() => {})
    bgmRef.current = audio
  }

  function stopBgm() {
    if (bgmRef.current) {
      bgmRef.current.pause()
      bgmRef.current = null
    }
  }

  useEffect(() => {
    socket.on('room:state', setRoomState)
    function onReconnect() {
      if (savedNickname.current) {
        socket.emit('room:join', { nickname: savedNickname.current })
      }
    }
    socket.on('connect', onReconnect)
    return () => {
      socket.off('room:state', setRoomState)
      socket.off('connect', onReconnect)
      stopBgm()
    }
  }, [socket])

  useEffect(() => {
    const status = roomState?.game?.status || null
    const isInGame = roomState?.game?.players?.includes(socket.id) ?? false
    const gameType = roomState?.game?.type || roomState?.game?.gameType
    const bgmState = `${status || 'none'}:${gameType || 'none'}:${isInGame ? 'in' : 'out'}`
    const prev = prevBgmState.current
    prevBgmState.current = bgmState

    if (bgmState === prev) return

    if (!roomState) {
      stopBgm()
      return
    }

    if (status === 'playing' && isInGame) {
      if (gameType === 'spelling') {
        stopBgm()
      } else {
        startBgm(BGM_BATTLE)
      }
    } else if (status === 'match_end' && isInGame) {
      startBgm(BGM_RESULT)
    } else {
      startBgm(BGM_LOBBY)
    }
  }, [roomState, socket.id])

  function handleEnter(name) {
    savedNickname.current = name
    setNickname(name)
    socket.emit('room:join', { nickname: name })
    startBgm(BGM_LOBBY)
  }

  function handleBack() {
    savedNickname.current = ''
    setRoomState(null)
    setNickname('')
    stopBgm()
  }

  if (!roomState) return <Home onEnter={handleEnter} />
  return <Room
    nickname={nickname}
    roomState={roomState}
    onBack={handleBack}
    onReturnToRoom={() => startBgm(BGM_LOBBY)}
  />
}

function App() {
  return (
    <AntApp>
      <GameApp />
    </AntApp>
  )
}

export default App
