import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import useSocket from './hooks/useSocket'
import Home from './pages/Home'
import Room from './pages/Room'
import Admin from './pages/Admin'

const BGM_LOBBY = '/bgm.mp3'
const BGM_BATTLE = '/bgm_battle.mp3'
const BGM_RESULT = '/bgm_result.mp3'
const BGM_VOLUME = 0.3

function GameApp() {
  const socket = useSocket()
  const [nickname, setNickname] = useState('')
  const [roomState, setRoomState] = useState(null)
  const bgmRef = useRef(null)
  const prevGameStatus = useRef(null)

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
    return () => {
      socket.off('room:state', setRoomState)
      stopBgm()
    }
  }, [socket])

  useEffect(() => {
    const status = roomState?.game?.status || null
    const prev = prevGameStatus.current
    prevGameStatus.current = status

    if (status === prev) return

    if (!roomState) {
      stopBgm()
    } else if (status === 'playing') {
      startBgm(BGM_BATTLE)
    } else if (status === 'match_end') {
      startBgm(BGM_RESULT)
    } else {
      startBgm(BGM_LOBBY)
    }
  }, [roomState])

  function handleEnter(name) {
    setNickname(name)
    socket.emit('room:join', { nickname: name })
    startBgm(BGM_LOBBY)
  }

  function handleBack() {
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
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<GameApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
