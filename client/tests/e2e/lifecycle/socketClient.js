import { expect, test as base } from '@playwright/test'
import { io } from 'socket.io-client'

const DEFAULT_SERVER_URL = 'http://localhost:4000'
const MAX_DIAGNOSTICS = 100

function sanitizeServerUrl(value) {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return 'invalid-url'
  }
}

function record(diagnostics, entry) {
  if (diagnostics.length >= MAX_DIAGNOSTICS) diagnostics.shift()
  diagnostics.push({ ...entry, time: new Date().toISOString() })
}

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

async function attachSocketDiagnostics(testInfo, diagnostics) {
  if (!testInfo.status || testInfo.status === 'passed' || testInfo.status === 'skipped') return
  await testInfo.attach('node-socket-diagnostics', {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: 'application/json',
  })
}

/**
 * Node Socket 仅用于无 UI 入口的 @lifecycle-issue 权限问题最小复现。
 * 诊断只记录连接层状态，不记录业务事件 Payload、答案、Cookie、Token 或 Socket auth。
 */
export const test = base.extend({
  socketClients: async ({}, use, testInfo) => {
    const sockets = []
    const diagnostics = []
    const serverUrl = process.env.E2E_SERVER_URL || DEFAULT_SERVER_URL
    const safeServerUrl = sanitizeServerUrl(serverUrl)

    async function connect(label) {
      record(diagnostics, { label, type: 'connect.attempt', serverUrl: safeServerUrl })
      const socket = io(serverUrl, {
        transports: ['websocket'],
        forceNew: true,
      })
      sockets.push(socket)

      socket.on('connect', () => {
        record(diagnostics, { label, type: 'connect', serverUrl: safeServerUrl })
      })
      socket.on('connect_error', (error) => {
        record(diagnostics, {
          label,
          type: 'connect_error',
          serverUrl: safeServerUrl,
          message: String(error?.message || error).slice(0, 500),
        })
      })
      socket.on('disconnect', (reason) => {
        record(diagnostics, {
          label,
          type: 'disconnect',
          serverUrl: safeServerUrl,
          reason: String(reason).slice(0, 200),
        })
      })

      await waitForSocketEvent(socket, 'connect', 5000)
      return socket
    }

    async function joinRoom(socket, nickname) {
      const statePromise = waitForSocketEvent(socket, 'room:state')
      socket.emit('room:join', { nickname })
      return await statePromise
    }

    try {
      await use({ connect, joinRoom, waitForEvent: waitForSocketEvent })
    } finally {
      sockets.forEach((socket) => socket?.close())
      await attachSocketDiagnostics(testInfo, diagnostics)
    }
  },
})

export { expect }
