import { io } from 'socket.io-client'
import { FAMILY_WAR_SOCKET_PATH } from '../config/services'

const host = window.location.hostname
const isDev = import.meta.env.DEV
const serverUrl = isDev ? `http://${host}:4000` : '/'
const socket = io(serverUrl, {
  transports: ['websocket', 'polling'],
  path: FAMILY_WAR_SOCKET_PATH,
})

export default function useSocket() {
  return socket
}
