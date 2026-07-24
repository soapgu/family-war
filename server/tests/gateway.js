/**
 * 公网网关验收
 *
 * 检查新旧 API 入口、Socket.IO polling/WebSocket，以及默写图片公网路径。
 *
 * GATEWAY_BASE_URL=http://localhost:8080 npm run test:gateway
 * npm run test:gateway:check
 */

const { io } = require('socket.io-client')

const CHECK_ONLY = process.argv.slice(2).includes('--check')
const BASE_URL = process.env.GATEWAY_BASE_URL?.replace(/\/+$/, '')
const NEW_API_BASE = '/api/family-war'
const LEGACY_API_BASE = '/family-war/api'
const SOCKET_PATHS = [
  { label: '标准入口', path: '/socket/family-war/' },
  { label: '兼容入口', path: '/family-war/socket.io/' },
]
const TRANSPORTS = ['polling', 'websocket']
const TIMEOUT_MS = 10000

function assert(condition, message) {
  if (!condition) throw new Error(message)
  console.log(`  ✓ ${message}`)
}

function waitForSocketEvent(socket, event, timeout = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`等待 Socket.IO 事件 ${event} 超时`))
    }, timeout)
    const handler = (data) => {
      clearTimeout(timer)
      socket.off(event, handler)
      resolve(data)
    }
    socket.on(event, handler)
  })
}

async function request(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = await response.text()
  return {
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    location: response.headers.get('location') || '',
    body,
  }
}

async function verifyAPICompatibility() {
  console.log('\n[API] 标准入口与兼容入口')
  const [standard, legacy] = await Promise.all([
    request(`${NEW_API_BASE}/health`),
    request(`${LEGACY_API_BASE}/health`),
  ])

  assert(standard.status === 200, '标准 API 健康检查返回 200')
  assert(legacy.status === 200, '兼容 API 健康检查返回 200')
  assert(!standard.location && !legacy.location, '新旧 API 均未经过 HTTP 重定向')
  assert(standard.contentType === legacy.contentType, '新旧 API Content-Type 一致')
  assert(standard.body === legacy.body, '新旧 API 业务响应一致')
}

async function connectAndJoin(path, transport, nickname) {
  const socket = io(BASE_URL, {
    path,
    transports: [transport],
    upgrade: false,
    reconnection: false,
    timeout: TIMEOUT_MS,
  })

  try {
    await Promise.race([
      waitForSocketEvent(socket, 'connect'),
      new Promise((_, reject) => {
        socket.once('connect_error', (error) => reject(error))
      }),
    ])
    const statePromise = waitForSocketEvent(socket, 'room:state')
    socket.emit('room:join', { nickname })
    const state = await statePromise
    assert(state.id === 'default', `${transport} 通过 ${path} 收到房间状态`)
    return socket
  } catch (error) {
    socket.close()
    throw new Error(`${transport} 连接 ${path} 失败：${error.message}`)
  }
}

async function verifySocketCompatibility() {
  console.log('\n[Socket.IO] polling 与 WebSocket')
  for (const entry of SOCKET_PATHS) {
    for (const transport of TRANSPORTS) {
      const nickname = `gateway-${entry.label}-${transport}-${Date.now()}`
      const socket = await connectAndJoin(entry.path, transport, nickname)
      socket.emit('room:leave')
      socket.close()
      console.log(`    ${entry.label} ${transport} 连接与事件往返成功`)
    }
  }
}

async function verifySpellingImage() {
  console.log('\n[图片] 服务端相对地址到标准公网 API')
  const socket = await connectAndJoin(
    '/socket/family-war/',
    'websocket',
    `gateway-image-${Date.now()}`,
  )

  try {
    const roleStatePromise = waitForSocketEvent(socket, 'room:state')
    socket.emit('role:select', { role: '爸爸' })
    await roleStatePromise
    const modeStatePromise = waitForSocketEvent(socket, 'room:state')
    socket.emit('game:setMode', { mode: 'spelling', difficulty: 'easy' })
    await modeStatePromise

    const gameStartPromise = waitForSocketEvent(socket, 'game:start')
    socket.emit('game:challenge', { mode: 'spelling' })
    const game = await gameStartPromise
    const internalImageURL = game.firstQuestion?.unsplashImageUrl

    assert(
      typeof internalImageURL === 'string' && internalImageURL.startsWith('/api/images/'),
      '默写题目返回内部 /api/images/* 图片地址',
    )

    const publicImagePath = `${NEW_API_BASE}${internalImageURL.slice('/api'.length)}`
    const image = await request(publicImagePath)
    assert(image.status === 200, `标准图片入口 ${publicImagePath} 返回 200`)
    assert(image.contentType.startsWith('image/'), '标准图片入口返回图片 Content-Type')
    assert(!image.location, '标准图片入口未经过 HTTP 重定向')
  } finally {
    socket.emit('game:forfeit')
    socket.emit('room:leave')
    socket.close()
  }
}

async function run() {
  if (CHECK_ONLY) {
    assert(typeof io === 'function', 'socket.io-client 依赖可用')
    assert(SOCKET_PATHS.length === 2 && TRANSPORTS.length === 2, '新旧 Socket.IO 双传输矩阵完整')
    console.log('网关验收脚本离线检查通过')
    return
  }

  if (!BASE_URL) {
    throw new Error('缺少 GATEWAY_BASE_URL，例如 http://localhost:8080')
  }
  const parsed = new URL(BASE_URL)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('GATEWAY_BASE_URL 仅支持 http 或 https')
  }

  console.log(`=== 公网网关验收：${BASE_URL} ===`)
  await verifyAPICompatibility()
  await verifySocketCompatibility()
  await verifySpellingImage()
  console.log('\n✅ 公网网关验收全部通过')
}

run().catch((error) => {
  console.error(`\n❌ 公网网关验收失败：${error.message}`)
  process.exitCode = 1
})
