import { io } from 'socket.io-client'

const serverUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '/'
const socket = io(serverUrl, { transports: ['websocket', 'polling'] })

export default function useSocket() {
  return socket
}
