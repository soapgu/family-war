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

  /**
   * 填入单个字母。不吞异常——调用方应先用 waitForInputReady 确认该格可用。
   */
  async fillLetter(index, char) {
    const input = this.page.getByTestId(`spelling-letter-input-${index}`)
    await input.fill(char)
  }

  async getLetterValue(index) {
    return await this.page.getByTestId(`spelling-letter-input-${index}`).inputValue()
  }

  /**
   * 等待指定格输入框出现且可编辑（可观察状态，而非固定等待）。
   * 在机器人推进题目、整组输入框被替换的瞬间，用此方法感知"当前题是否就绪"。
   */
  async waitForInputReady(index, timeout = 10000) {
    await this.page.waitForFunction(
      (i) => {
        const input = document.querySelector(`[data-testid="spelling-letter-input-${i}"]`)
        return !!input && !input.disabled
      },
      index,
      { timeout }
    )
  }

  /**
   * 等待答错反馈出现：提交错误答案后输入框变 disabled+readOnly（answered 态）。
   * 这是用户可观察的"已作答"信号，不依赖隐藏 DOM 或 Socket Payload。
   */
  async waitForAnsweredFeedback(timeout = 10000) {
    await this.page.waitForFunction(
      () => {
        const input = document.querySelector('[data-testid="spelling-letter-input-0"]')
        return !!input && input.disabled
      },
      { timeout }
    )
  }

  /**
   * 一轮内尽可能把所有空格都填成 char（故意答错）。
   *
   * 用「输入框是否仍属于当前题」这一可观察状态判断：
   * 若填到中途机器人已答对并推进到下一题，当前题的输入框会消失，
   * 此时直接结束本轮（机器人已经得分，无需再填），而不是静默吞掉 fill 异常。
   */
  async answerAllWrong(char) {
    const count = await this.getLetterInputCount()
    for (let i = 0; i < count; i++) {
      try {
        await this.waitForInputReady(i, 5000)
        await this.fillLetter(i, char)
      } catch {
        // 输入框已消失 → 机器人已推进题目，本轮无需继续
        return
      }
    }
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
