/**
 * Socket 集成测试
 * 启动真实 server，用 socket.io-client 模拟两个玩家走完一局完整流程。
 * 用法: npm run test:integration
 */

const { spawn } = require('child_process')
const path = require('path')

const SERVER_SCRIPT = path.join(__dirname, '..', 'src', 'index.js')
const PORT = 4001

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [SERVER_SCRIPT], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let started = false

    server.stdout.on('data', (data) => {
      const text = data.toString()
      if (!started && text.includes('Server running')) {
        started = true
        resolve({ process: server, url: `http://localhost:${PORT}` })
      }
    })

    server.stderr.on('data', (data) => {
      console.error('[server]', data.toString().trim())
    })

    setTimeout(() => {
      if (!started) {
        server.kill()
        reject(new Error('Server start timeout'))
      }
    }, 5000)
  })
}

/**
 * 等待 socket 事件（一次性，自动清理监听）
 */
function waitFor(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event)
      reject(new Error(`等待 ${event} 超时`))
    }, timeout)
    socket.once(event, (data) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}

async function run() {
  console.log('\n=== 集成测试开始 ===\n')

  const { process: server, url } = await startServer()
  console.log(`[OK] 服务已启动 (端口 ${PORT})\n`)

  const { io: client } = require('socket.io-client')

  const s1 = client(url, { transports: ['websocket'] })
  const s2 = client(url, { transports: ['websocket'] })

  await Promise.all([
    waitFor(s1, 'connect'),
    waitFor(s2, 'connect'),
  ])
  console.log(`[OK] 小明 (${s1.id}) & 小红 (${s2.id}) 已连接\n`)

  let passed = 0
  let failed = 0

  function assert(condition, label) {
    if (condition) { passed++; console.log(`  ✓ ${label}`) }
    else { failed++; console.log(`  ✗ ${label}`) }
  }

  // ========== 1. join 房间 ==========

  s1.emit('room:join', { nickname: '小明' })
  const state1 = await waitFor(s1, 'room:state')
  assert(state1.id === 'default', '房间 ID default')
  assert(state1.players.length === 1, '1 个玩家')
  assert(state1.players[0].nickname === '小明', '昵称 小明')

  s2.emit('room:join', { nickname: '小红' })
  const state2 = await waitFor(s2, 'room:state')
  assert(state2.players.length === 2, '2 个玩家')

  console.log('')

  // ========== 2. 选角色 ==========

  s1.emit('role:select', { role: '爸爸' })
  const rs1 = await waitForRoomState(s1, (s) => s.roles['爸爸']?.nickname === '小明')
  assert(rs1.roles['爸爸'].nickname === '小明', '小明选 爸爸')

  s2.emit('role:select', { role: '妈妈' })
  const rs2 = await waitForRoomState(s2, (s) => s.roles['妈妈']?.nickname === '小红')
  assert(rs2.roles['妈妈'].nickname === '小红', '小红选 妈妈')

  console.log('')

  // ========== 3. 挑战 ==========

  s1.emit('game:challenge', { targetId: s2.id })
  const [gs1, gs2] = await Promise.all([
    waitFor(s1, 'game:start'),
    waitFor(s2, 'game:start'),
  ])
  assert(gs1.opponent.id === s2.id, '小明看到对手是小红')
  assert(gs2.opponent.id === s1.id, '小红看到对手是小明')
  assert(typeof gs1.round === 'number', 'round 为数字')

  console.log('')

  // ========== 4. 第 1 局: 小明 rock vs 小红 scissors → 小明赢 ==========

  s1.emit('game:move', { choice: 'rock' })
  await waitFor(s1, 'game:waiting')

  s2.emit('game:move', { choice: 'scissors' })

  const [rr1a, rr1b] = await Promise.all([
    waitFor(s1, 'game:roundResult'),
    waitFor(s2, 'game:roundResult'),
  ])
  assert(rr1a.winner === s1.id, '第1局小明胜 (s1视角)')
  assert(rr1a.yourMove === 'rock', 's1 出了 rock')
  assert(rr1a.oppMove === 'scissors', '对手出了 scissors')
  assert(rr1a.scores[s1.id] === 1, '小明 1 分')

  assert(rr1b.winner === s1.id, '第1局小明胜 (s2视角)')
  assert(rr1b.yourMove === 'scissors', 's2 出了 scissors')
  assert(rr1b.oppMove === 'rock', '对手出了 rock')

  console.log('')

  // ========== 5. 第 2 局: 小明 paper vs 小红 rock → 小明赢 → 赛果 ==========

  s1.emit('game:move', { choice: 'paper' })
  s2.emit('game:move', { choice: 'rock' })

  const [mr1, mr2] = await Promise.all([
    waitFor(s1, 'game:matchResult'),
    waitFor(s2, 'game:matchResult'),
  ])
  assert(mr1.matchWinner === s1.id, '赛果小明胜 (s1视角)')
  assert(mr1.scores[s1.id] === 2, '小明总分 2')
  assert(mr1.scores[s2.id] === 0, '小红总分 0')
  assert(mr1.history.length === 2, '2 局历史')

  assert(mr2.matchWinner === s1.id, '赛果小明胜 (s2视角)')

  console.log('')

  // ========== 结果 ==========

  s1.close()
  s2.close()
  server.kill()

  console.log(`\n=== 集成测试结果 ===`)
  console.log(`  通过: ${passed}`)
  console.log(`  失败: ${failed}`)
  console.log(failed === 0 ? '\n  ✅ 全部通过\n' : `\n  ❌ ${failed} 个失败\n`)
  process.exit(failed > 0 ? 1 : 0)
}

/**
 * 等待 room:state 直到满足 predicate
 */
function waitForRoomState(socket, predicate) {
  return new Promise((resolve) => {
    const handler = (state) => {
      if (predicate(state)) {
        socket.off('room:state', handler)
        resolve(state)
      }
    }
    socket.on('room:state', handler)
  })
}

run().catch((err) => {
  console.error('\n[ERROR]', err.message)
  process.exit(1)
})
