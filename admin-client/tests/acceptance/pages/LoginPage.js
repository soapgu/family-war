/** 管理员登录流程的页面对象。 */
class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page Playwright 页面。
   * @param {import('../types').AcceptanceConfig} config 验收配置。
   */
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  /** 打开需要管理员权限的页面。 */
  async goto() {
    await this.page.goto(this.config.adminBaseURL + '/family-war', { waitUntil: 'networkidle' })
  }

  /** @returns {Promise<boolean>} 当前浏览器会话是否已登录。 */
  async isLoggedIn() {
    return await this.page.evaluate(async (authPath) => {
      try {
        const res = await fetch(`${authPath}/me`)
        return res.ok
      } catch {
        return false
      }
    }, this.config.authPath)
  }

  /** 使用验收配置中的密码完成登录。 */
  async login() {
    const dialog = this.page.getByRole('dialog', { name: '管理员登录' })
    await dialog.waitFor({ state: 'visible', timeout: 10000 })
    await dialog.getByPlaceholder('请输入管理密码').fill(this.config.adminPassword)
    const loginResponsePromise = this.page.waitForResponse(
      (res) => new URL(res.url()).pathname === `${this.config.authPath}/login`
        && res.request().method() === 'POST'
    )
    await dialog.getByRole('button', { name: /登录/ }).click()
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

  /** 打开页面，并在需要时自动登录。 */
  async ensureAuthenticated() {
    await this.goto()
    if (!(await this.isLoggedIn())) {
      await this.login()
    }
  }

  /** @param {string} path 截图输出路径。 */
  async screenshot(path) {
    await this.page.screenshot({ path, fullPage: true })
  }
}

module.exports = { LoginPage }
