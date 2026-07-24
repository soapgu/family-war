class WordConfigPage {
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  async navigate() {
    await this.page.goto(this.config.adminBaseURL + '/family-war/word-config', { waitUntil: 'networkidle' })
  }

  async getWordCount(chapterIndex) {
    if (chapterIndex !== undefined) {
      const cards = this.page.locator('.word-config-chapter-card')
      const card = cards.nth(chapterIndex)
      return await card.locator('.word-config-word-row').count()
    }
    return await this.page.locator('.word-config-word-row').count()
  }

  async getChapterCount() {
    return await this.page.locator('.word-config-chapter-card').count()
  }

  async getChapterToggle(chapterIndex) {
    const cards = this.page.locator('.word-config-chapter-card')
    const card = cards.nth(chapterIndex)
    const switch_ = card.locator('.ant-switch').first()
    if (!(await switch_.count())) return null
    return await switch_.getAttribute('aria-checked')
  }

  async toggleChapter(chapterIndex) {
    const cards = this.page.locator('.word-config-chapter-card')
    const card = cards.nth(chapterIndex)
    const switch_ = card.locator('.ant-switch').first()
    await switch_.click()
    await this.page.waitForTimeout(300)
  }

  async getWordSwitchState(chapterIndex, wordIndex) {
    const cards = this.page.locator('.word-config-chapter-card')
    const card = cards.nth(chapterIndex)
    const switches = card.locator('.word-config-word-row .ant-switch')
    if (wordIndex >= await switches.count()) return null
    return await switches.nth(wordIndex).getAttribute('aria-checked')
  }

  async toggleWord(chapterIndex, wordIndex) {
    const cards = this.page.locator('.word-config-chapter-card')
    const card = cards.nth(chapterIndex)
    const switches = card.locator('.word-config-word-row .ant-switch')
    await switches.nth(wordIndex).click()
    await this.page.waitForTimeout(300)
  }

  async getWordText(chapterIndex, wordIndex) {
    const cards = this.page.locator('.word-config-chapter-card')
    const card = cards.nth(chapterIndex)
    const names = card.locator('.word-config-word-name')
    return await names.nth(wordIndex).innerText()
  }

  async getDisabledText() {
    const el = this.page.locator('.ant-alert-message')
    if (await el.count() > 0) return await el.innerText()
    return null
  }

  async clickSave() {
    await this.page.click('button:has-text("保存配置")')
    await this.page.waitForTimeout(500)
  }

  async clickRefresh() {
    await this.page.click('button:has-text("刷新")')
    await this.page.waitForTimeout(500)
  }

  async getSaveResult() {
    const toast = this.page.locator('.ant-message-notice')
    if (await toast.count()) {
      return await toast.innerText()
    }
    return null
  }

  async screenshot(path) {
    await this.page.screenshot({ path, fullPage: true })
  }
}

module.exports = { WordConfigPage }
