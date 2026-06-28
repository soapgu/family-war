import { io } from 'socket.io-client'

const host = window.location.hostname
const serverUrl = process.env.NODE_ENV === 'development' ? `http://${host}:4000` : '/'
const socket = io(serverUrl, { transports: ['websocket', 'polling'] })

export default function useSocket() {
  return socket
}
