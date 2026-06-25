import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

export default function useSocket() {
  const socketRef = useRef(null)

  useEffect(() => {
    socketRef.current = io('/', { transports: ['websocket', 'polling'] })
    return () => {
      socketRef.current.close()
    }
  }, [])

  return socketRef.current
}
