class HomePage {
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  async goto() {
    await this.page.goto(this.config.baseURL, { waitUntil: 'networkidle' })
  }

  async enterNickname(name) {
    await this.page.fill('input[placeholder="输入昵称"]', name)
  }

  async clickEnter() {
    await this.page.click('button:has-text("进入房间")')
  }

  async join(name) {
    await this.goto()
    await this.enterNickname(name)
    await this.clickEnter()
  }
}

module.exports = { HomePage }
