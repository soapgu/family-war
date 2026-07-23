class LoginPage {
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  async goto() {
    await this.page.goto(this.config.webBaseURL + '/admin', { waitUntil: 'networkidle' })
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
    await this.page.click('button:has-text("登录")')
    await this.page.waitForFunction(
      () => !document.querySelector('.ant-modal'),
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
