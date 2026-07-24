class LoginPage {
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  async goto() {
    await this.page.goto(this.config.adminBaseURL + '/family-war', { waitUntil: 'networkidle' })
  }

  async isLoggedIn() {
    return await this.page.evaluate(async () => {
      try {
        const res = await fetch('/family-war/api/admin/status')
        return res.ok
      } catch {
        return false
      }
    })
  }

  async login() {
    await this.page.waitForSelector('.ant-modal', { timeout: 10000 })
    await this.page.fill('input[placeholder="请输入管理密码"]', this.config.adminPassword)
    const loginResponsePromise = this.page.waitForResponse(
      (res) => res.url().includes('/api/admin/login') && res.request().method() === 'POST'
    )
    await this.page.click('button:has-text("登录")')
    const loginResponse = await loginResponsePromise
    if (!loginResponse.ok()) {
      const body = await loginResponse.json().catch(() => ({}))
      throw new Error(
        `管理员登录失败: HTTP ${loginResponse.status()} ${body.error || loginResponse.statusText()}`
      )
    }
    await this.page.waitForFunction(
      () => !document.querySelector('.ant-modal'),
      null,
      { timeout: 10000 }
    )
  }

  async ensureAuthenticated() {
    await this.goto()
    if (!(await this.isLoggedIn())) {
      await this.login()
    }
  }

  async screenshot(path) {
    await this.page.screenshot({ path, fullPage: true })
  }
}

module.exports = { LoginPage }
