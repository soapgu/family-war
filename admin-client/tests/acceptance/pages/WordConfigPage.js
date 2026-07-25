/** 词库配置页的页面对象。 */
class WordConfigPage {
  /**
   * @param {import('@playwright/test').Page} page Playwright 页面。
   * @param {import('../types').AcceptanceConfig} config 验收配置。
   */
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  /** 打开词库配置页面。 */
  async navigate() {
    await this.page.goto(this.config.adminBaseURL + '/family-war/word-config', { waitUntil: 'networkidle' })
  }

  /**
   * @param {number} [chapterIndex] 可选章节索引。
   * @returns {Promise<number>} 单词数量。
   */
  async getWordCount(chapterIndex) {
    if (chapterIndex !== undefined) {
      const cards = this.page.locator('.word-config-chapter-card')
      const card = cards.nth(chapterIndex)
      return await card.locator('.word-config-word-row').count()
    }
    return await this.page.locator('.word-config-word-row').count()
  }

  /** @returns {Promise<number>} 章节数量。 */
  async getChapterCount() {
    return await this.page.locator('.word-config-chapter-card').count()
  }

  /**
   * @param {number} chapterIndex 章节索引。
   * @returns {Promise<string | null>} 章节开关状态。
   */
  async getChapterToggle(chapterIndex) {
    const cards = this.page.locator('.word-config-chapter-card')
    const card = cards.nth(chapterIndex)
    const switch_ = card.locator('.ant-switch').first()
    if (!(await switch_.count())) return null
    return await switch_.getAttribute('aria-checked')
  }

  /** @param {number} chapterIndex */
  async toggleChapter(chapterIndex) {
    const cards = this.page.locator('.word-config-chapter-card')
    const card = cards.nth(chapterIndex)
    const switch_ = card.locator('.ant-switch').first()
    await switch_.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * @param {number} chapterIndex 章节索引。
   * @param {number} wordIndex 单词索引。
   * @returns {Promise<string | null>} 单词开关状态。
   */
  async getWordSwitchState(chapterIndex, wordIndex) {
    const cards = this.page.locator('.word-config-chapter-card')
    const card = cards.nth(chapterIndex)
    const switches = card.locator('.word-config-word-row .ant-switch')
    if (wordIndex >= await switches.count()) return null
    return await switches.nth(wordIndex).getAttribute('aria-checked')
  }

  /**
   * @param {number} chapterIndex 章节索引。
   * @param {number} wordIndex 单词索引。
   */
  async toggleWord(chapterIndex, wordIndex) {
    const cards = this.page.locator('.word-config-chapter-card')
    const card = cards.nth(chapterIndex)
    const switches = card.locator('.word-config-word-row .ant-switch')
    await switches.nth(wordIndex).click()
    await this.page.waitForTimeout(300)
  }

  /**
   * @param {number} chapterIndex 章节索引。
   * @param {number} wordIndex 单词索引。
   * @returns {Promise<string>} 单词文本。
   */
  async getWordText(chapterIndex, wordIndex) {
    const cards = this.page.locator('.word-config-chapter-card')
    const card = cards.nth(chapterIndex)
    const names = card.locator('.word-config-word-name')
    return await names.nth(wordIndex).innerText()
  }

  /** @returns {Promise<string | null>} 禁用原因提示。 */
  async getDisabledText() {
    const el = this.page.locator('.ant-alert-message')
    if (await el.count() > 0) return await el.innerText()
    return null
  }

  /** 保存当前词库配置。 */
  async clickSave() {
    await this.page.click('button:has-text("保存配置")')
    await this.page.waitForTimeout(500)
  }

  /** 从服务端刷新词库配置。 */
  async clickRefresh() {
    await this.page.click('button:has-text("刷新")')
    await this.page.waitForTimeout(500)
  }

  /** @returns {Promise<string | null>} 保存结果消息。 */
  async getSaveResult() {
    const toast = this.page.locator('.ant-message-notice')
    if (await toast.count()) {
      return await toast.innerText()
    }
    return null
  }

  /** @param {string} path 截图输出路径。 */
  async screenshot(path) {
    await this.page.screenshot({ path, fullPage: true })
  }
}

module.exports = { WordConfigPage }
