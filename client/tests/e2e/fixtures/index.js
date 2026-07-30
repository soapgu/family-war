import { test as base } from '@playwright/test'
import { HomePage } from '../pages/HomePage.js'
import { RoomPage } from '../pages/RoomPage.js'

// ─── 昵称生成器 ────────────────────────────────────────────

let seq = 0
const pid = process.pid
const seed = Date.now().toString(36)

function makeNickname(label = 'p') {
  return `e2e-${pid}-${seed}-${label}-${++seq}`
}

// ─── 诊断监听 ──────────────────────────────────────────────

/**
 * 去除 URL 中的查询参数和 hash，避免测试附件中泄露 token 等敏感信息。
 * @param {string} url
 * @returns {string}
 */
function sanitizeUrl(url) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}${u.pathname}`
  } catch {
    return url
  }
}

/**
 * 在 Page 上注册全局诊断监听器（pageerror / console.error / 请求失败 / WebSocket 断连）。
 * 返回的诊断对象会在测试失败时作为 JSON 附件写入 test-results。
 * @param {import('@playwright/test').Page} page
 * @returns {{ errors: Array<Object>, requestFailures: Array<Object>, socketEvents: Array<Object> }}
 */
function registerDiagnostics(page) {
  const MAX = 50
  const diagnostics = {
    errors: [],
    requestFailures: [],
    socketEvents: [],
    expectedClose: false, // cleanup 主动关闭 Context 前置 true，避免正常关闭被记为断连噪声
  }

  page.on('pageerror', (error) => {
    if (diagnostics.errors.length >= MAX) diagnostics.errors.shift()
    diagnostics.errors.push({
      type: 'pageerror',
      message: String(error.message).slice(0, 500),
      time: new Date().toISOString(),
    })
  })

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      if (diagnostics.errors.length >= MAX) diagnostics.errors.shift()
      diagnostics.errors.push({
        type: 'console.error',
        text: String(msg.text()).slice(0, 500),
        time: new Date().toISOString(),
      })
    }
  })

  page.on('requestfailed', (request) => {
    if (diagnostics.requestFailures.length >= MAX) diagnostics.requestFailures.shift()
    diagnostics.requestFailures.push({
      url: sanitizeUrl(request.url()),
      method: request.method(),
      failure: request.failure()?.errorText || 'unknown',
      time: new Date().toISOString(),
    })
  })

  page.on('websocket', (ws) => {
    ws.on('close', () => {
      // 跳过 cleanup 阶段的预期关闭，避免失败附件混入清理噪声
      if (diagnostics.expectedClose) return
      if (diagnostics.socketEvents.length >= MAX) diagnostics.socketEvents.shift()
      diagnostics.socketEvents.push({
        type: 'ws.close',
        url: sanitizeUrl(ws.url()),
        time: new Date().toISOString(),
      })
    })
    ws.on('frameerror', (error) => {
      if (diagnostics.socketEvents.length >= MAX) diagnostics.socketEvents.shift()
      diagnostics.socketEvents.push({
        type: 'ws.frameerror',
        url: sanitizeUrl(ws.url()),
        error: String(error.message).slice(0, 500),
        time: new Date().toISOString(),
      })
    })
  })

  return diagnostics
}

/**
 * 测试失败时，将诊断数据作为 JSON 附件写入 test-results。
 * 成功场景不生成任何附件。
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {{ errors: Array<Object>, requestFailures: Array<Object>, socketEvents: Array<Object> }} diagnostics
 * @param {string} [label] - 附件名前缀（双人场景区分 playerA / playerB）
 */
async function attachDiagnostics(testInfo, diagnostics, label = '') {
  if (!testInfo) return
  const prefix = label ? `${label}-` : ''
  if (!testInfo.status || testInfo.status === 'passed' || testInfo.status === 'skipped') return

  if (diagnostics.errors.length > 0) {
    await testInfo.attach(`${prefix}page-errors`, {
      body: JSON.stringify(diagnostics.errors, null, 2),
      contentType: 'application/json',
    })
  }
  if (diagnostics.requestFailures.length > 0) {
    await testInfo.attach(`${prefix}request-failures`, {
      body: JSON.stringify(diagnostics.requestFailures, null, 2),
      contentType: 'application/json',
    })
  }
  if (diagnostics.socketEvents.length > 0) {
    await testInfo.attach(`${prefix}socket-events`, {
      body: JSON.stringify(diagnostics.socketEvents, null, 2),
      contentType: 'application/json',
    })
  }
}

// ─── 类型定义（JSDoc，提供 IDE 智能提示）────────────────────
//
// 在 test 函数参数中写 ({ dualPlayers }) 时：
//   dualPlayers        → { a: PlayerHandle, b: PlayerHandle }
//   dualPlayers.a      → { ctx: BrowserContext, page: Page, nickname: string }
//   dualPlayers.a.page → Playwright Page 对象

/**
 * 单人玩家句柄
 * @typedef {Object} PlayerHandle
 * @property {import('@playwright/test').BrowserContext} ctx        - 独立的浏览器上下文
 * @property {import('@playwright/test').Page}            page      - 该上下文中的页面
 * @property {string}                                     nickname  - 自动生成的唯一昵称
 * @property {{ errors: Array<Object>, requestFailures: Array<Object>, socketEvents: Array<Object> }} diagnostics - 诊断数据（测试失败时自动附件）
 */

/**
 * 双人玩家句柄
 * @typedef {Object} DualPlayers
 * @property {PlayerHandle} a - 玩家 A
 * @property {PlayerHandle} b - 玩家 B
 */

// ═══════════════════════════════════════════════════════════
// 关于 Playwright fixture 的 `use` 模式（详细说明）
// ═══════════════════════════════════════════════════════════
//
// 所谓 fixture，就是"测试需要的共享资源"（浏览器上下文、页面、昵称等）。
//
// Playwright 的 fixture 工厂是一个 async 函数，签名为：
//
//   async ({ 依赖的其他fixture }, use) => { ... }
//
// 这个函数会在测试执行时被调用，分三个阶段：
//
//  ┌─── use() 之前 ───→  Setup（准备阶段）
//  │                      创建资源、初始化状态
//  │
//  ├─── use(value) ───→  测试执行阶段
//  │                      value 会作为参数传递给 test 回调
//  │                      测试体在此期间运行
//  │                      无论测试成功/失败，use() 都会返回
//  │
//  └─── use() 之后 ───→  Cleanup（清理阶段）
//                         释放资源、关闭连接
//                         任何异常都不会阻止这步执行
//
// 举例：singlePlayer fixture 的执行时间线——
//
//   1. 创建 ctx + page（setup）
//   2. use({ ctx, page, nickname }) ← 测试函数从这里拿到值
//   3. ... 测试体运行中 ...
//   4. 测试体结束（或抛出异常）
//   5. page.close() + ctx.close()（cleanup，必然执行）
//
// 这相当于自动替你做了 try/finally，不需要手写。

// ═══════════════════════════════════════════════════════════
// 自定义 fixtures
// ═══════════════════════════════════════════════════════════

/**
 * Playwright test 扩展，注册了 singlePlayer 和 dualPlayers 两个自定义 fixture。
 *
 * 用法：所有 E2E spec 都从这个文件导入 test，代替从 @playwright/test 导入。
 *
 * @example
 *   // 单人场景
 *   test('人机对战', async ({ singlePlayer, baseURL }) => {
 *     const { page, nickname } = singlePlayer
 *     await joinRoom(page, nickname, baseURL)
 *     // ...
 *   })
 *
 * @example
 *   // 双人场景
 *   test('双人对战', async ({ dualPlayers, baseURL }) => {
 *     const a = dualPlayers.a.page
 *     const b = dualPlayers.b.page
 *     await joinRoom(a, dualPlayers.a.nickname, baseURL)
 *     // ...
 *   })
 */
export const test = base.extend({

  /**
   * 单人测试场景。
   *
   * 创建一个独立的 BrowserContext + Page + 唯一昵称。
   * 测试结束后自动关闭 Context（同时断开 Socket.IO 连接）。
   *
   * @param {{ browser: import('@playwright/test').Browser }} fixtures
   * @param {Function} use - value -> 测试回调 -> cleanup
   * @returns {Promise<void>}
   */
  singlePlayer: async ({ browser }, use) => {
    // ---------- setup ----------
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const nickname = makeNickname()
    const diagnostics = registerDiagnostics(page)
    // ---------- 测试运行 ----------
    await use({ ctx, page, nickname, diagnostics })
    // ---------- cleanup ----------
    diagnostics.expectedClose = true
    await attachDiagnostics(test.info(), diagnostics)
    await page.close()
    await ctx.close()           // 断开该 Context 对应的 Socket.IO 连接
  },

  /**
   * 双人测试场景（两个玩家在各自独立的浏览器上下文中交互）。
   *
   * 创建两个独立的 BrowserContext，分别带有唯一昵称。
   * 测试结束后自动同时关闭两个 Context。
   *
   * @param {{ browser: import('@playwright/test').Browser }} fixtures
   * @param {Function} use
   * @returns {Promise<void>}
   */
  dualPlayers: async ({ browser }, use) => {
    // ---------- setup ----------
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()
    const diagA = registerDiagnostics(pageA)
    const diagB = registerDiagnostics(pageB)
    /** @type {DualPlayers} */
    const pair = {
      a: { ctx: ctxA, page: pageA, nickname: makeNickname('A'), diagnostics: diagA },
      b: { ctx: ctxB, page: pageB, nickname: makeNickname('B'), diagnostics: diagB },
    }
    // ---------- 测试运行 ----------
    await use(pair)
    // ---------- cleanup ----------
    diagA.expectedClose = true
    diagB.expectedClose = true
    const info = test.info()
    await attachDiagnostics(info, diagA, 'playerA')
    await attachDiagnostics(info, diagB, 'playerB')
    await Promise.all([pageA.close(), pageB.close()])
    await Promise.all([ctxA.close(), ctxB.close()])
  },

})

// ═══════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════

/**
 * 进入房间：打开首页 → 输入昵称 → 点击进入 → 等待房间页面就绪。
 *
 * @param {import('@playwright/test').Page} page - Playwright 页面对象
 * @param {string} nickname - 玩家昵称
 * @param {string} baseURL - 游戏前端地址（从 Playwright `baseURL` fixture 获取）
 * @returns {Promise<void>}
 */
export async function joinRoom(page, nickname, baseURL) {
  const home = new HomePage(page)
  const room = new RoomPage(page)
  await home.join(nickname, baseURL)
  await room.waitForRoomReady()
}
