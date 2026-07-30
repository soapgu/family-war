import { io } from 'socket.io-client'

const DEFAULT_SERVER_URL = 'http://localhost:4000'

export function waitForSocketEvent(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent)
      reject(new Error(`等待 ${event} 超时`))
    }, timeout)

    function onEvent(payload) {
      clearTimeout(timer)
      resolve(payload)
    }

    socket.once(event, onEvent)
  })
}

export async function connectSocket() {
  const socket = io(process.env.E2E_SERVER_URL || DEFAULT_SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
  })
  await waitForSocketEvent(socket, 'connect', 5000)
  return socket
}

export async function joinSocketRoom(socket, nickname) {
  const statePromise = waitForSocketEvent(socket, 'room:state')
  socket.emit('room:join', { nickname })
  return await statePromise
}

export function closeSockets(sockets) {
  sockets.forEach((socket) => socket?.close())
}
