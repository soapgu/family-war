import { expect } from '@playwright/test'
import { test, joinRoom } from './fixtures/index.js'
import { RoomPage } from './pages/RoomPage.js'
import { SpellingBoardPage } from './pages/SpellingBoardPage.js'

/**
 * 1l 默写核心交互：难度切换 → 开始比赛 → TTS 重播 → 图片提示 → 字母输入 → 错误反馈
 *
 * 不追求完赛（留给 1m），只验证关键 UI 元素的可见性和交互性。
 */
test('默写核心交互：难度切换、发音、字母输入、图片提示、错误反馈', async ({ singlePlayer, baseURL }) => {
  const { page, nickname } = singlePlayer

  // ── 1. 进入房间、选角 ────────────────────────────────────────
  await joinRoom(page, nickname, baseURL)
  const room = new RoomPage(page)
  await room.selectRole('爸爸')
  await room.waitForRoleSelected()

  // ── 2. 切换为默写模式 ────────────────────────────────────────
  await room.switchToMode('spelling')

  // ── 3. 难度切换：验证按钮变 primary ─────────────────────────
  await room.switchDifficulty('normal')
  await expect(page.getByTestId('room-difficulty-normal')).toHaveClass(/ant-btn-primary/, { timeout: 5000 })

  await room.switchDifficulty('hard')
  await expect(page.getByTestId('room-difficulty-hard')).toHaveClass(/ant-btn-primary/, { timeout: 5000 })

  await room.switchDifficulty('easy')
  await expect(page.getByTestId('room-difficulty-easy')).toHaveClass(/ant-btn-primary/, { timeout: 5000 })

  // ── 4. 开始比赛 ──────────────────────────────────────────────
  await page.getByTestId('room-start-match-btn').click()
  const board = new SpellingBoardPage(page)
  await board.waitForQuestion()

  // ── 5. 验证比赛面板中难度正确 ───────────────────────────────
  const boardDifficulty = await board.getDifficulty()
  expect(boardDifficulty, '比赛面板难度').toBe('简单')

  // ── 6. TTS 重播按钮可点击（不验证是否有声音输出）───────────
  await board.clickReplay()

  // ── 7. 图片提示：加载成功或有降级占位都算通过 ────────────────
  const hasImage = await board.isImageVisible()
  if (!hasImage) {
    await expect(page.getByTestId('spelling-image-clue')).toContainText('暂无图片提示', { timeout: 3000 })
  }

  // ── 8. 字母输入 + 错误反馈 ───────────────────────────────────
  const count = await board.getLetterInputCount()
  expect(count, '至少有一个空格').toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    await board.fillLetter(i, 'z')
  }

  await expect(page.getByTestId('spelling-letter-input-0')).toBeDisabled({ timeout: 10000 })
})
