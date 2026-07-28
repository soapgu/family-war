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

// ─── 类型定义（JSDoc，提供 IDE 智能提示）────────────────────
//
// 在 test 函数参数中写 ({ dualPlayers }) 时：
//   dualPlayers        → { a: PlayerHandle, b: PlayerHandle }
//   dualPlayers.a      → { ctx: BrowserContext, page: Page, nickname: string }
//   dualPlayers.a.page → Playwright Page 对象

/**
 * 单人玩家句柄
 * @typedef {Object} PlayerHandle
 * @property {import('@playwright/test').BrowserContext} ctx   - 独立的浏览器上下文
 * @property {import('@playwright/test').Page}            page - 该上下文中的页面
 * @property {string}                                     nickname - 自动生成的唯一昵称
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
    // ---------- 测试运行 ----------
    await use({ ctx, page, nickname })
    // ---------- cleanup ----------
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
    /** @type {DualPlayers} */
    const pair = {
      a: { ctx: ctxA, page: pageA, nickname: makeNickname('A') },
      b: { ctx: ctxB, page: pageB, nickname: makeNickname('B') },
    }
    // ---------- 测试运行 ----------
    await use(pair)
    // ---------- cleanup ----------
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
