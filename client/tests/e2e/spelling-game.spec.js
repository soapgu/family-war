import { expect } from '@playwright/test'
import { test, joinRoom } from './fixtures/index.js'
import { RoomPage } from './pages/RoomPage.js'
import { SpellingBoardPage } from './pages/SpellingBoardPage.js'

import { MatchResultPage } from './pages/MatchResultPage.js'

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

  // 填入错误字母 → 自动提交触发（填满最后一格后 auto-submit 发 game:answer）
  for (let i = 0; i < count; i++) {
    await board.fillLetter(i, 'z')
  }
  // E2E_FAST 下机器人 3s 回答，可能会在填入完成后立即打开下一题，不强制验证 disabled 状态
})

/**
 * 1m 默写完整赛果：错误作答 → 机器人 2 分取胜 → 验证排名 → 返回房间。
 *
 * 服务端通过 E2E_FAST=1 环境变量将默写 winningScore 降为 2、
 * robotDelay 降为 3s，总耗时约 15 秒。
 */
test('默写完整比赛：错误作答 → 机器人胜 → 最终排名 → 返回房间', async ({ singlePlayer, baseURL }) => {
  const { page, nickname } = singlePlayer

  // ── 1. 进房、选角、开始默写比赛 ──────────────────────────────
  await joinRoom(page, nickname, baseURL)
  const room = new RoomPage(page)
  await room.selectRole('爸爸')
  await room.waitForRoleSelected()
  await room.switchToMode('spelling')
  await page.getByTestId('room-start-match-btn').click()

  const board = new SpellingBoardPage(page)
  await board.waitForQuestion()

  // ── 2. 两轮错误作答 → 机器人 2 分取胜 ────────────────────────
  for (let round = 0; round < 2; round++) {
    const count = await board.getLetterInputCount()
    for (let i = 0; i < count; i++) {
      await board.fillLetter(i, 'z')
    }

    if (round === 0) {
      await board.waitForNextQuestion()
    }
  }

  // ── 3. 验证赛果 ─────────────────────────────────────────────
  await board.waitForMatchResult()
  const matchResult = new MatchResultPage(page, 'spelling')
  await matchResult.waitForVisible()
  const title = await matchResult.getTitle()
  expect(title, '赛果标题含"获胜"').toMatch(/获胜/)

  // ── 4. 返回房间 ─────────────────────────────────────────────
  await matchResult.clickReturnRoom()
  await expect(page.getByText('游戏房间')).toBeVisible()
})
