import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import useSocket from './hooks/useSocket'
import Home from './pages/Home'
import Room from './pages/Room'
import Admin from './pages/Admin'

function GameApp() {
  const socket = useSocket()
  const [nickname, setNickname] = useState('')
  const [roomState, setRoomState] = useState(null)

  useEffect(() => {
    socket.on('room:state', setRoomState)
    return () => socket.off('room:state', setRoomState)
  }, [socket])

  function handleEnter(name) {
    setNickname(name)
    socket.emit('room:join', { nickname: name })
  }

  function handleBack() {
    setRoomState(null)
    setNickname('')
  }

  if (!roomState) return <Home onEnter={handleEnter} />
  return <Room nickname={nickname} roomState={roomState} onBack={handleBack} />
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
