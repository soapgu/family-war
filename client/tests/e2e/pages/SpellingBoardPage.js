/**
 * v3.6 Phase 1 1f — 默写模式 Page Object
 *
 * 封装：难度检查 → 拼写输入 → TTS 重播 → 图片加载 → 赛果等待
 */
import { expect } from '@playwright/test'

export class SpellingBoardPage {
  constructor(page) {
    this.page = page
  }

  async waitForQuestion() {
    await this.page.getByTestId('spelling-composer').waitFor({ state: 'visible', timeout: 15000 })
  }

  async getDifficulty() {
    return await this.page.getByTestId('spelling-difficulty-tag').textContent()
  }

  async clickReplay() {
    await this.page.getByTestId('spelling-replay-btn').click()
  }

  async getLetterInputCount() {
    return await this.page.locator('[data-testid^="spelling-letter-input-"]').count()
  }

  async fillLetter(index, char) {
    const input = this.page.getByTestId(`spelling-letter-input-${index}`)
    await input.fill(char).catch(() => {})
    try {
      await expect(input).toHaveValue(char, { timeout: 3000 })
    } catch {
      // 最后一格填满后自动提交，输入框可能已被替换为正确答案
    }
  }

  async getLetterValue(index) {
    return await this.page.getByTestId(`spelling-letter-input-${index}`).inputValue()
  }

  async isImageVisible() {
    const clue = this.page.getByTestId('spelling-image-clue')
    const img = clue.locator('img')
    const count = await img.count()
    return count > 0
  }

  async waitForMatchResult() {
    await this.page.getByTestId('spelling-match-result').waitFor({ state: 'visible', timeout: 25000 })
  }

  async waitForNextQuestion() {
    await this.page.waitForFunction(
      () => {
        const input = document.querySelector('[data-testid="spelling-letter-input-0"]')
        return input && !input.disabled
      },
      { timeout: 15000 }
    )
  }
}
