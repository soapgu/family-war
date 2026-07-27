/**
 * 公网网关验收
 *
 * GATEWAY_BASE_URL=http://localhost:8080 \
 * GATEWAY_ADMIN_PASSWORD=... \
 * GATEWAY_LEGACY_MODE=compatible \
 * npm run test:gateway
 *
 * GATEWAY_LEGACY_MODE:
 * - compatible: v3.3—v3.4，新旧 API/Socket.IO 均必须可用；
 * - removed: v3.5，旧入口不得成功代理，也不得重定向。
 */

const { io } = require('socket.io-client')

const CHECK_ONLY = process.argv.slice(2).includes('--check')
const BASE_URL = process.env.GATEWAY_BASE_URL?.replace(/\/+$/, '')
const ADMIN_PASSWORD = process.env.GATEWAY_ADMIN_PASSWORD
const API_BASE = normalizeBase(process.env.GATEWAY_API_BASE || '/api/family-war')
const AUTH_BASE = normalizeBase(process.env.GATEWAY_AUTH_BASE || '/api/admin-auth')
const SOCKET_PATH = normalizeSocketPath(
  process.env.GATEWAY_SOCKET_PATH || '/socket/family-war/',
)
const LEGACY_MODE = process.env.GATEWAY_LEGACY_MODE || 'compatible'
const LEGACY_API_BASE = '/family-war/api'
const LEGACY_SOCKET_PATH = '/family-war/socket.io/'
const TRANSPORTS = ['polling', 'websocket']
const TIMEOUT_MS = 10000

function normalizeBase(path) {
  return `/${String(path).replace(/^\/+|\/+$/g, '')}`
}

function normalizeSocketPath(path) {
  return `${normalizeBase(path)}/`
}

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

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...options,
  })
  const body = await response.text()
  return {
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    location: response.headers.get('location') || '',
    setCookie: response.headers.get('set-cookie') || '',
    body,
  }
}

function parseJSON(response, label) {
  try {
    return JSON.parse(response.body)
  } catch {
    throw new Error(`${label} 未返回 JSON`)
  }
}

function cookieHeader(setCookie) {
  return setCookie.split(';', 1)[0]
}

async function verifyAdminAuth() {
  console.log('\n[管理员认证] 独立认证入口与 HttpOnly Cookie')
  const login = await request(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  })

  assert(login.status === 200, '管理员登录返回 200')
  assert(!login.location, '管理员登录未经过 HTTP 重定向')
  assert(login.setCookie.includes('admin_session='), '登录设置 admin_session Cookie')
  assert(/;\s*httponly/i.test(login.setCookie), 'admin_session 设置 HttpOnly')
  assert(/;\s*samesite=lax/i.test(login.setCookie), 'admin_session 设置 SameSite=Lax')
  if (new URL(BASE_URL).protocol === 'https:') {
    assert(/;\s*secure/i.test(login.setCookie), 'HTTPS 登录设置 Secure')
  }
  const loginBody = parseJSON(login, '管理员登录')
  assert(loginBody.success === true, '登录响应只返回成功状态')
  assert(!('token' in loginBody), '登录响应不暴露 JWT')

  const sessionCookie = cookieHeader(login.setCookie)
  const me = await request(`${AUTH_BASE}/me`, {
    headers: { Cookie: sessionCookie },
  })
  assert(me.status === 200, '携带管理员 Cookie 的 me 返回 200')
  const meBody = parseJSON(me, '当前管理员')
  assert(meBody.authenticated === true, 'me 返回已认证状态')
  assert(meBody.admin?.role === 'admin', 'me 返回最小管理员身份')
  assert(!('rooms' in meBody) && !('matchHistory' in meBody), 'me 不返回业务状态')

  const logout = await request(`${AUTH_BASE}/logout`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
  })
  assert(logout.status === 200, '管理员退出返回 200')
  assert(!logout.location, '管理员退出未经过 HTTP 重定向')
  assert(logout.setCookie.includes('admin_session='), '退出响应使用 admin_session Cookie')
  assert(
    /expires=Thu, 01 Jan 1970|max-age=-?0|max-age=-1/i.test(logout.setCookie),
    '退出响应删除 admin_session Cookie',
  )

  const afterLogout = await request(`${AUTH_BASE}/me`)
  assert(afterLogout.status === 401, '退出后无 Cookie 的 me 返回 401')
}

async function verifyStandardAPI() {
  console.log('\n[API] 标准 family-war 入口')
  const standard = await request(`${API_BASE}/health`)
  assert(standard.status === 200, '标准 API 健康检查返回 200')
  assert(!standard.location, '标准 API 未经过 HTTP 重定向')
  assert(standard.contentType.includes('application/json'), '标准 API 返回 JSON')
  assert(parseJSON(standard, '标准 API').status === 'ok', '标准 API 业务响应正确')
  return standard
}

async function verifyLegacyAPI(standard) {
  const legacy = await request(`${LEGACY_API_BASE}/health`)
  if (LEGACY_MODE === 'compatible') {
    console.log('\n[旧 API] 兼容模式')
    assert(legacy.status === 200, '兼容 API 健康检查返回 200')
    assert(!legacy.location, '兼容 API 未经过 HTTP 重定向')
    assert(standard.contentType === legacy.contentType, '新旧 API Content-Type 一致')
    assert(standard.body === legacy.body, '新旧 API 业务响应一致')
    return
  }

  console.log('\n[旧 API] 下线模式')
  assert(!legacy.location, '旧 API 下线后没有 301/302 Location')
  assert(legacy.status < 300 || legacy.status >= 400, '旧 API 下线后不返回重定向状态')
  const stillProxied = (
    legacy.status === 200 &&
    legacy.contentType.includes('application/json') &&
    legacy.body === standard.body
  )
  assert(!stillProxied, '旧 API 不再成功代理 family-war 健康接口')
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

async function expectSocketUnavailable(path, transport) {
  const socket = io(BASE_URL, {
    path,
    transports: [transport],
    upgrade: false,
    reconnection: false,
    timeout: 3000,
  })

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close()
        reject(new Error(`${transport} 连接旧入口未在预期时间内失败`))
      }, 5000)
      socket.once('connect', () => {
        clearTimeout(timer)
        socket.close()
        reject(new Error(`${transport} 仍可连接旧 Socket.IO 入口`))
      })
      socket.once('connect_error', () => {
        clearTimeout(timer)
        socket.close()
        resolve()
      })
    })
    assert(true, `${transport} 无法连接旧 Socket.IO 入口`)
  } finally {
    socket.close()
  }
}

async function verifySockets() {
  console.log('\n[Socket.IO] 标准入口 polling 与 WebSocket')
  for (const transport of TRANSPORTS) {
    const socket = await connectAndJoin(
      SOCKET_PATH,
      transport,
      `gateway-standard-${transport}-${Date.now()}`,
    )
    socket.emit('room:leave')
    socket.close()
    console.log(`    标准入口 ${transport} 连接与事件往返成功`)
  }

  if (LEGACY_MODE === 'compatible') {
    console.log('\n[旧 Socket.IO] 兼容模式')
    for (const transport of TRANSPORTS) {
      const socket = await connectAndJoin(
        LEGACY_SOCKET_PATH,
        transport,
        `gateway-legacy-${transport}-${Date.now()}`,
      )
      socket.emit('room:leave')
      socket.close()
      console.log(`    兼容入口 ${transport} 连接与事件往返成功`)
    }
    return
  }

  console.log('\n[旧 Socket.IO] 下线模式')
  const legacyPolling = await request(
    `${LEGACY_SOCKET_PATH}?EIO=4&transport=polling&t=gateway-removal-check`,
  )
  assert(!legacyPolling.location, '旧 Socket.IO polling 没有 301/302 Location')
  assert(
    !legacyPolling.body.startsWith('0{'),
    '旧 Socket.IO polling 不再返回 Engine.IO 握手',
  )
  for (const transport of TRANSPORTS) {
    await expectSocketUnavailable(LEGACY_SOCKET_PATH, transport)
  }
}

async function verifySpellingImage() {
  console.log('\n[图片] 服务端相对地址到标准公网 API')
  const socket = await connectAndJoin(
    SOCKET_PATH,
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

    const publicImagePath = `${API_BASE}${internalImageURL.slice('/api'.length)}`
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

function verifyConfiguration() {
  assert(typeof io === 'function', 'socket.io-client 依赖可用')
  assert(TRANSPORTS.length === 2, 'Socket.IO polling/WebSocket 双传输矩阵完整')
  assert(['compatible', 'removed'].includes(LEGACY_MODE), '旧入口模式为 compatible 或 removed')
  assert(API_BASE === '/api/family-war', '默认 family-war API Base 正确')
  assert(AUTH_BASE === '/api/admin-auth', '默认管理员认证 Base 正确')
  assert(SOCKET_PATH === '/socket/family-war/', '默认 Socket.IO path 正确')
}

async function run() {
  if (CHECK_ONLY) {
    verifyConfiguration()
    console.log('网关验收脚本离线检查通过')
    return
  }

  if (!BASE_URL) {
    throw new Error('缺少 GATEWAY_BASE_URL，例如 http://localhost:8080')
  }
  if (ADMIN_PASSWORD === undefined) {
    throw new Error('缺少 GATEWAY_ADMIN_PASSWORD')
  }
  const parsed = new URL(BASE_URL)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('GATEWAY_BASE_URL 仅支持 http 或 https')
  }
  if (!['compatible', 'removed'].includes(LEGACY_MODE)) {
    throw new Error('GATEWAY_LEGACY_MODE 仅支持 compatible 或 removed')
  }

  console.log(`=== 公网网关验收：${BASE_URL}（旧入口：${LEGACY_MODE}）===`)
  await verifyAdminAuth()
  const standard = await verifyStandardAPI()
  await verifyLegacyAPI(standard)
  await verifySockets()
  await verifySpellingImage()
  console.log('\n✅ 公网网关验收全部通过')
}

run().catch((error) => {
  console.error(`\n❌ 公网网关验收失败：${error.message}`)
  process.exitCode = 1
})
