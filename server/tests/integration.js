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
  assert(state1.players.length === 2, '1 个玩家 + 机器人')
  assert(state1.players.find((p) => p.nickname === '小明'), '昵称 小明')

  s2.emit('room:join', { nickname: '小红' })
  const state2 = await waitFor(s2, 'room:state')
  assert(state2.players.length === 3, '2 个玩家 + 机器人')

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

  // ========== 6. 算术模式集成测试 ==========

  // 重新选角色，切换算术模式
  s1.emit('role:select', { role: '爸爸' })
  await waitForRoomState(s1, (s) => s.roles['爸爸']?.nickname === '小明')
  s2.emit('role:select', { role: '妈妈' })
  await waitForRoomState(s2, (s) => s.roles['妈妈']?.nickname === '小红')

  s1.emit('game:setMode', { mode: 'arithmetic' })
  const modeState = await waitForRoomState(s1, (s) => s.gameMode === 'arithmetic')
  assert(modeState.gameMode === 'arithmetic', '切换算术模式')

  const staleModeErrorPromise = waitFor(s1, 'game:error')
  s1.emit('game:challenge', { mode: 'spelling' })
  const staleModeError = await staleModeErrorPromise
  assert(staleModeError.message === '游戏模式已变更，请返回房间重试', '拒绝发起非当前房间模式的挑战')

  s1.emit('game:challenge', { mode: 'arithmetic' })
  const [as1, as2] = await Promise.all([
    waitFor(s1, 'game:start'),
    waitFor(s2, 'game:start'),
  ])
  assert(as1.gameType === 'arithmetic', '算术 game:start 含 gameType')
  assert(as1.players.length === 3, '3 名玩家参赛（含机器人）')
  assert(as2.players.length === 3, '小红也看到 3 名玩家')
  assert(as1.firstQuestion, 'game:start 含 firstQuestion')
  assert(typeof as1.firstQuestion.expression === 'string', 'firstQuestion 含表达式')

  const q1 = as1.firstQuestion

  // 小明答对第 1 题（预注册下一题 + roundResult）
  const q2Promise = waitFor(s1, 'game:question')
  const rr1Promise = waitFor(s1, 'game:roundResult')
  s1.emit('game:answer', { questionId: q1.questionId, answer: eval(q1.expression) })
  const rr1 = await rr1Promise
  assert(rr1.gameType === 'arithmetic', '算术 roundResult 含 gameType')
  assert(rr1.winner === s1.id, '小明答对第 1 题')
  assert(rr1.scores[s1.id] === 1, '小明 1 分')

  // 小红答错第 2 题 → 验证 answerAck
  const q2 = await q2Promise
  const ackPromise = waitFor(s2, 'game:answerAck')
  s2.emit('game:answer', { questionId: q2.questionId, answer: 99999 })
  const ack = await ackPromise
  assert(!ack.correct, 'answerAck 标记为错误')
  assert(typeof ack.correctAnswer === 'number', 'answerAck 含 correctAnswer')
  assert(ack.expression === q2.expression, 'answerAck 含 expression')

  // 小明答对第 2 题
  const q3Promise = waitFor(s1, 'game:question')
  const rr2Promise = waitFor(s1, 'game:roundResult')
  s1.emit('game:answer', { questionId: q2.questionId, answer: eval(q2.expression) })
  const rr2 = await rr2Promise
  assert(rr2.winner === s1.id, '小明答对第 2 题')
  assert(rr2.scores[s1.id] === 2, '小明 2 分')

  // 验证第 3 题正常流转
  const q3 = await q3Promise
  assert(q3.round === 3, '第 3 题 round 为 3')

  console.log('')

  // ========== 7. 默写模式集成测试 ==========

  // 清掉算术残局（只答了 3 题，未结束）
  s1.emit('game:forfeit')

  // 重新选角色
  s1.emit('role:select', { role: '爸爸' })
  await waitForRoomState(s1, (s) => s.roles['爸爸']?.nickname === '小明')
  s2.emit('role:select', { role: '妈妈' })
  await waitForRoomState(s2, (s) => s.roles['妈妈']?.nickname === '小红')

  // 切换默写模式 + 难度
  s1.emit('game:setMode', { mode: 'spelling', difficulty: 'easy' })
  const spellingModeState = await waitForRoomState(s1, (s) => s.gameMode === 'spelling')
  assert(spellingModeState.gameMode === 'spelling', '切换默写模式')
  assert(spellingModeState.spellingDifficulty === 'easy', '储存难度 easy')

  // 发起默写挑战
  s1.emit('game:challenge', { mode: 'spelling' })
  const [ss1, ss2] = await Promise.all([
    waitFor(s1, 'game:start'),
    waitFor(s2, 'game:start'),
  ])
  assert(ss1.gameType === 'spelling', '默写 game:start 含 gameType')
  assert(ss1.players.length === 3, '3 名玩家参赛（含机器人）')
  assert(ss1.difficulty === 'easy', 'game:start 含难度')
  assert(ss1.firstQuestion, 'game:start 含 firstQuestion')
  assert(typeof ss1.firstQuestion.ttsText === 'string', 'firstQuestion 含 ttsText')
  assert(typeof ss1.firstQuestion.wordLength === 'number', 'firstQuestion 含 wordLength')
  assert(typeof ss1.firstQuestion.blanks === 'string', 'firstQuestion 含 blanks')
  assert(ss1.firstQuestion.blanks.includes('_'), 'blanks 包含下划线')
  assert(typeof ss1.firstQuestion.unsplashImageUrl === 'string', 'unsplashImageUrl 为字符串')
  assert(ss1.firstQuestion.unsplashImageUrl === '' || ss1.firstQuestion.unsplashImageUrl.startsWith('/api/images/'), 'unsplashImageUrl 格式正确')

  const sq1 = ss1.firstQuestion

  // 非字符串答案应返回业务错误，且不影响玩家随后正常答题
  const invalidAnswerPromise = waitFor(s2, 'game:error')
  s2.emit('game:answer', { questionId: sq1.questionId, answer: null })
  const invalidAnswerError = await invalidAnswerPromise
  assert(invalidAnswerError.message === '答案必须是非空字符串', '默写拒绝非字符串答案')

  // 数字答案也应被拒绝
  const numErrorPromise = waitFor(s2, 'game:error')
  s2.emit('game:answer', { questionId: sq1.questionId, answer: 123 })
  const numError = await numErrorPromise
  assert(numError.message === '答案必须是非空字符串', '默写拒绝数字答案')

  // 对象答案也应被拒绝
  const objErrorPromise = waitFor(s2, 'game:error')
  s2.emit('game:answer', { questionId: sq1.questionId, answer: {} })
  const objError = await objErrorPromise
  assert(objError.message === '答案必须是非空字符串', '默写拒绝对象答案')

  // s2 故意答错 → 捕获正确单词
  const spellingAckPromise = waitFor(s2, 'game:answerAck')
  s2.emit('game:answer', { questionId: sq1.questionId, answer: 'wrongguess' })
  const spellingAck = await spellingAckPromise
  assert(!spellingAck.correct, 'answerAck 标记为错误')
  assert(typeof spellingAck.correctAnswer === 'string', 'answerAck 含正确单词')
  assert(spellingAck.word === spellingAck.correctAnswer, 'answerAck 含 word 字段')

  // s1 用正确单词回答
  const sq2Promise = waitFor(s1, 'game:question')
  const srr1Promise = waitFor(s1, 'game:roundResult')
  s1.emit('game:answer', { questionId: sq1.questionId, answer: spellingAck.correctAnswer })
  const srr1 = await srr1Promise
  assert(srr1.gameType === 'spelling', 'roundResult 含 gameType')
  assert(srr1.winner === s1.id, '小明答对')
  assert(srr1.word === spellingAck.correctAnswer, 'roundResult 含 word')
  assert(typeof srr1.blanks === 'string', 'roundResult 含 blanks')

  // 验证下一题广播
  const sq2 = await sq2Promise
  assert(typeof sq2.wordLength === 'number', '下一题含 wordLength')
  assert(typeof sq2.blanks === 'string', '下一题含 blanks')
  assert(typeof sq2.ttsText === 'string', '下一题含 ttsText')
  assert(sq2.round === 2, '下一题 round 为 2')

  // 小明继续答对 4 题，让默写比赛真实结束
  let currentQuestion = sq2
  let spellingMatchResult
  for (let expectedScore = 2; expectedScore <= 5; expectedScore++) {
    const isFinalRound = expectedScore === 5
    const nextQuestionPromise = isFinalRound ? null : waitFor(s1, 'game:question')
    const resultPromise = waitFor(s1, isFinalRound ? 'game:matchResult' : 'game:roundResult')

    s1.emit('game:answer', {
      questionId: currentQuestion.questionId,
      answer: currentQuestion.ttsText,
    })

    const result = await resultPromise
    assert(result.scores[s1.id] === expectedScore, `默写小明达到 ${expectedScore} 分`)

    if (isFinalRound) {
      spellingMatchResult = result
    } else {
      currentQuestion = await nextQuestionPromise
    }
  }

  assert(spellingMatchResult.gameType === 'spelling', '默写赛果含 gameType')
  assert(spellingMatchResult.matchWinner === s1.id, '默写比赛小明获胜')
  assert(spellingMatchResult.history.length === 5, '默写赛果包含 5 题历史')
  assert(spellingMatchResult.ranking[0].playerId === s1.id, '默写终榜小明第一')

  // 结算后调整当前房间配置，重赛必须重新读取难度与角色阵容
  s1.emit('game:setMode', { mode: 'spelling', difficulty: 'hard' })
  const hardState = await waitForRoomState(s1, (s) => s.spellingDifficulty === 'hard')
  assert(hardState.spellingDifficulty === 'hard', '结算后难度改为 hard')

  s2.emit('role:deselect')
  const rosterState = await waitForRoomState(s1, (s) => !s.roles['妈妈'])
  assert(!rosterState.roles['妈妈'], '结算后小红退出参赛角色')

  s1.emit('game:challenge', { mode: 'spelling' })
  const rematchStart = await waitFor(s1, 'game:start')
  assert(rematchStart.gameType === 'spelling', '重赛仍为 spelling')
  assert(rematchStart.difficulty === 'hard', '重赛沿用当前房间难度')
  assert(rematchStart.players.length === 2, '重赛重新读取角色阵容（小明 + 机器人）')
  assert(!rematchStart.players.some((p) => p.id === s2.id), '重赛不包含已退出角色的小红')
  assert(rematchStart.round === 1, '重赛 round 重置为 1')
  assert(rematchStart.firstQuestion.round === 1, '重赛首题 round 为 1')
  assert(rematchStart.firstQuestion.questionId !== sq1.questionId, '重赛题目 ID 已更新')

  const rematchRoundPromise = waitFor(s1, 'game:roundResult')
  s1.emit('game:answer', {
    questionId: rematchStart.firstQuestion.questionId,
    answer: rematchStart.firstQuestion.ttsText,
  })
  const rematchRound = await rematchRoundPromise
  assert(rematchRound.scores[s1.id] === 1, '重赛比分从 0 重新累计')
  assert(rematchRound.round === 1, '重赛第一题结果 round 为 1')

  // 模拟旧结算页：房间已切换模式后再发起 spelling 重赛应明确拒绝
  s1.emit('game:forfeit')
  s1.emit('game:setMode', { mode: 'arithmetic' })
  await waitForRoomState(s1, (s) => s.gameMode === 'arithmetic')
  const oldResultErrorPromise = waitFor(s1, 'game:error')
  s1.emit('game:challenge', { mode: 'spelling' })
  const oldResultError = await oldResultErrorPromise
  assert(oldResultError.message === '游戏模式已变更，请返回房间重试', '旧默写结算页不能跨模式重赛')

  console.log('')

  // ========== 9. 算术结算后 game:rematch 被拒绝 ==========

  s2.emit('role:select', { role: '妈妈' })
  await waitForRoomState(s1, (s) => s.roles['妈妈']?.nickname === '小红')

  s1.emit('game:challenge', { mode: 'arithmetic' })
  const [aras1] = await Promise.all([
    waitFor(s1, 'game:start'),
    waitFor(s2, 'game:start'),
  ])
  assert(aras1.gameType === 'arithmetic', '算术 rematch 测试 game:start')

  let aq = aras1.firstQuestion
  for (let i = 0; i < 5; i++) {
    const isLast = i === 4
    const resultPromise = waitFor(s1, isLast ? 'game:matchResult' : 'game:roundResult')
    const nextPromise = isLast ? null : waitFor(s1, 'game:question')

    s1.emit('game:answer', { questionId: aq.questionId, answer: eval(aq.expression) })

    const result = await resultPromise
    assert(result.scores[s1.id] === i + 1, `算术小明 ${i + 1} 分`)

    if (isLast) {
      assert(result.matchWinner === s1.id, '算术赛果小明胜')
    } else {
      aq = await nextPromise
    }
  }

  const rematchRejectPromise = waitFor(s1, 'game:error')
  s1.emit('game:rematch')
  const rematchReject = await rematchRejectPromise
  assert(rematchReject.message === '当前游戏不支持该重赛方式', '算术 rematch 被拒绝')

  console.log('')

  // ========== 10. 参赛者离开取消整场 + 定时器清理（LIFE-001） ==========

  s1.emit('game:setMode', { mode: 'spelling', difficulty: 'easy' })
  await waitForRoomState(s1, (s) => s.gameMode === 'spelling')

  s1.emit('game:challenge', { mode: 'spelling' })
  const [tss1] = await Promise.all([
    waitFor(s1, 'game:start'),
    waitFor(s2, 'game:start'),
  ])
  assert(tss1.gameType === 'spelling', '定时器清理测试 game:start')
  assert(tss1.firstQuestion.questionId, '定时器已启动（robotScheduler.schedule 在 game:challenge 中已调用）')
  const oldQuestionId = tss1.firstQuestion.questionId

  // s1 参赛者中途离开 -> 应取消整场并通知 s2（LIFE-001 修复）
  const cancelPromise = waitFor(s2, 'game:cancelled')
  s1.emit('room:leave')
  const cancelMsg = await cancelPromise
  assert(cancelMsg.message === '对手离开了房间', 's2 收到 game:cancelled（参赛者离开取消整场）')

  // 旧对局已清 + 机器人调度已清：s2 用旧 questionId 答题应被拒，调度不再推进
  const errPromise = waitFor(s2, 'game:error')
  s2.emit('game:answer', { questionId: oldQuestionId, answer: 'x' })
  const errMsg = await errPromise
  assert(errMsg.message === '没有进行中的比赛', '旧对局已清，s2 答题被拒（机器人调度不再推进）')

  // s2 离开（最后一人 -> 房间删除 -> 定时器清理）
  s2.emit('room:leave')
  await sleep(500)

  // s1 重新加入 -> 验证干净房间
  s1.emit('room:join', { nickname: '小明' })
  const cleanState = await waitFor(s1, 'room:state')
  assert(cleanState.id === 'default', '重新加入默认房间')
  assert(!cleanState.game, '新房间不含游戏残留')

  console.log('')

  // ========== 11. 旁观者认输被拒 + A/B 继续对局（LIFE-002） ==========

  // s1 已在 section 10 末重新加入；s2 重新加入 + s3 新加入
  const s3 = client(url, { transports: ['websocket'] })
  await waitFor(s3, 'connect')
  s2.emit('room:join', { nickname: '小红' })
  s3.emit('room:join', { nickname: '小刚' })
  await waitForRoomState(s1, (s) => s.players.length >= 4)

  // 三人选角色
  s1.emit('role:select', { role: '爸爸' })
  await waitForRoomState(s1, (s) => s.roles['爸爸']?.nickname === '小明')
  s2.emit('role:select', { role: '妈妈' })
  await waitForRoomState(s2, (s) => s.roles['妈妈']?.nickname === '小红')
  s3.emit('role:select', { role: '儿子' })
  await waitForRoomState(s3, (s) => s.roles['儿子']?.nickname === '小刚')

  // 切 RPS + s1 挑战 s2
  s1.emit('game:setMode', { mode: 'rps' })
  await waitForRoomState(s1, (s) => s.gameMode === 'rps')
  const startA = waitFor(s1, 'game:start')
  const startB = waitFor(s2, 'game:start')
  s1.emit('game:challenge', { mode: 'rps', targetId: s2.id })
  await Promise.all([startA, startB])

  // s3 旁观者认输 -> 应被拒
  const spectatorErrPromise = waitFor(s3, 'game:error')
  s3.emit('game:forfeit')
  const spectatorErr = await spectatorErrPromise
  assert(spectatorErr.message === '你不是本局玩家', '旁观者认输被拒（你不是本局玩家）')

  // 原对局不变：s1/s2 不收 game:cancelled/forfeited（短超时探针）
  let unexpected = false
  const onUnexpected = () => { unexpected = true }
  s1.once('game:cancelled', onUnexpected)
  s1.once('game:forfeited', onUnexpected)
  s2.once('game:cancelled', onUnexpected)
  s2.once('game:forfeited', onUnexpected)
  await sleep(300)
  assert(!unexpected, '旁观者认输后 A/B 对局未被取消')
  s1.off('game:cancelled', onUnexpected)
  s1.off('game:forfeited', onUnexpected)
  s2.off('game:cancelled', onUnexpected)
  s2.off('game:forfeited', onUnexpected)

  // A/B 继续当前轮并完成第 1 局
  s1.emit('game:move', { choice: 'rock' })
  await waitFor(s1, 'game:waiting')
  s2.emit('game:move', { choice: 'scissors' })
  const [resultA, resultB] = await Promise.all([
    waitFor(s1, 'game:roundResult'),
    waitFor(s2, 'game:roundResult'),
  ])
  assert(resultA.round === 1 && resultB.round === 1, '旁观者认输后 A/B 完成第 1 局')

  s3.close()
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
