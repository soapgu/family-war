import { expect } from '@playwright/test'
import { test, joinRoom } from './fixtures/index.js'
import { RoomPage } from './pages/RoomPage.js'

/**
 * 1j 房间与角色同步：双人进房 → 在线人数/昵称 → 角色选择/占用/切换/放弃 → 模式/难度切换
 *
 * 所有验证点均跨两个独立浏览器上下文，利用 Playwright expect 的 auto-retry 等待
 * Socket.IO 事件传播完成。
 */
test('房间与角色同步：双人进房、角色选择占用切换放弃、模式/难度切换', async ({ dualPlayers, baseURL }) => {
  const { a, b } = dualPlayers

  // ── 1. 两人进入房间 ─────────────────────────────────────────
  await joinRoom(a.page, a.nickname, baseURL)
  await joinRoom(b.page, b.nickname, baseURL)
  const roomA = new RoomPage(a.page)
  const roomB = new RoomPage(b.page)

  // ── 2. 在线人数同步 ─────────────────────────────────────────
  const onlineTagA = a.page.locator('.ant-tag').filter({ hasText: '人在线' })
  const onlineTagB = b.page.locator('.ant-tag').filter({ hasText: '人在线' })
  await expect(onlineTagA).toBeVisible()
  await expect(onlineTagB).toBeVisible()
  await expect(onlineTagA).toContainText('2')
  await expect(onlineTagB).toContainText('2')

  // ── 3. 昵称在对方可见 ───────────────────────────────────────
  // 用 .ant-tag 过滤避免 Toast 消息也匹配昵称造成 strict mode
  await expect(b.page.locator('.ant-tag').filter({ hasText: a.nickname })).toBeVisible()
  await expect(a.page.locator('.ant-tag').filter({ hasText: b.nickname })).toBeVisible()

  // ── 4. A 选择 爸爸 → B 看到 爸爸 被 A 占用 ──────────────────
  await roomA.selectRole('爸爸')
  await roomA.waitForRoleSelected()
  await expect(
    b.page.getByTestId('role-cards').locator('.ant-tag').filter({ hasText: a.nickname })
  ).toBeVisible({ timeout: 10000 })

  // ── 5. B 选择 妈妈 → A 看到 妈妈 被 B 占用 ─────────────────
  await roomB.selectRole('妈妈')
  await roomB.waitForRoleSelected()
  await expect(
    a.page.getByTestId('role-cards').locator('.ant-tag').filter({ hasText: b.nickname })
  ).toBeVisible({ timeout: 10000 })

  // ── 6. A 切换为 儿子 ────────────────────────────────────────
  //      B 看到 爸爸 释放（空闲标签出现）、儿子被 A 占用
  await roomA.selectRole('儿子')
  await roomA.waitForRoleSelected()
  // 爸爸 卡片应出现"空闲"
  await expect(
    b.page.getByTestId('role-cards').getByText('空闲').first()
  ).toBeVisible({ timeout: 10000 })
  // 儿子 卡片出现 A 的昵称
  await expect(
    b.page.getByTestId('role-cards').locator('.ant-tag').filter({ hasText: a.nickname })
  ).toBeVisible({ timeout: 10000 })

  // ── 7. A 放弃角色 ──────────────────────────────────────────
  await roomA.deselectRole()
  // A 看到提示文字
  await expect(a.page.getByText('选择一个角色加入游戏')).toBeVisible({ timeout: 10000 })
  // B 看到 儿子 释放
  await expect(
    b.page.getByTestId('role-cards').getByText('空闲').first()
  ).toBeVisible({ timeout: 10000 })

  // ── 8. A 切换模式为 算术 → B 看到开始比赛按钮 ──────────────
  await roomA.switchToMode('arithmetic')
  await expect(b.page.getByTestId('room-start-match-btn')).toBeVisible({ timeout: 10000 })

  // ── 9. B 切换模式为 默写 → A 看到难度按钮 ──────────────────
  await roomB.switchToMode('spelling')
  await expect(a.page.getByTestId('room-difficulty-easy')).toBeVisible({ timeout: 10000 })

  // ── 10. A 切换难度为 HARD → B 看到 HARD 按钮高亮 ──────────
  await roomA.switchDifficulty('hard')
  await expect(
    b.page.getByTestId('room-difficulty-hard').filter({ hasText: 'HARD' })
  ).toBeVisible({ timeout: 10000 })
})
