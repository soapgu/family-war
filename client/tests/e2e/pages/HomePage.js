export class HomePage {
  constructor(page) {
    this.page = page
  }

  async goto(baseURL) {
    await this.page.goto(baseURL, { waitUntil: 'networkidle' })
  }

  async waitForReady() {
    await this.page.getByTestId('home-nickname-input')
      .waitFor({ state: 'visible', timeout: 10000 })
  }

  async getNicknameValue() {
    return await this.page.getByTestId('home-nickname-input').inputValue()
  }

  async enterNickname(name) {
    await this.page.getByTestId('home-nickname-input').fill(name)
  }

  async clickEnter() {
    await this.page.getByTestId('home-enter-room-btn').click()
  }

  async join(name, baseURL) {
    await this.goto(baseURL)
    await this.enterNickname(name)
    await this.clickEnter()
  }
}
