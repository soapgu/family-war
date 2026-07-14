import { io } from 'socket.io-client'

const host = window.location.hostname
const isDev = import.meta.env.DEV
const serverUrl = isDev ? `http://${host}:4000` : '/'
const socket = io(serverUrl, {
  transports: ['websocket', 'polling'],
  path: isDev ? '/socket.io' : '/family-war/socket.io',
})

export default function useSocket() {
  return socket
}
