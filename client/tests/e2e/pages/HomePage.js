export class HomePage {
  constructor(page) {
    this.page = page
  }

  async goto(baseURL) {
    await this.page.goto(baseURL, { waitUntil: 'networkidle' })
  }

  async enterNickname(name) {
    await this.page.fill('input[placeholder="输入昵称"]', name)
  }

  async clickEnter() {
    await this.page.click('button:has-text("进入房间")')
  }

  async join(name, baseURL) {
    await this.goto(baseURL)
    await this.enterNickname(name)
    await this.clickEnter()
  }
}
