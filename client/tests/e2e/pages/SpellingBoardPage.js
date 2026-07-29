/**
 * v3.6 Phase 1 1f — 默写模式 Page Object
 *
 * 封装：难度检查 → 拼写输入 → TTS 重播 → 图片加载 → 赛果等待
 */
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
    await input.click()
    await input.fill(char)
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
}
