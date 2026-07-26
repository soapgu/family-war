/** 管理首页的页面对象。 */
class AdminDashboard {
  /**
   * @param {import('@playwright/test').Page} page Playwright 页面。
   * @param {import('../types').AcceptanceConfig} config 验收配置。
   */
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  /** 打开管理首页。 */
  async goto() {
    await this.page.goto(this.config.adminBaseURL + '/family-war', { waitUntil: 'networkidle' })
  }

  /** @returns {Promise<boolean>} 管理首页标题是否可见。 */
  async isVisible() {
    return await this.page.getByRole('heading', { name: '后台管理', exact: true }).isVisible()
  }

  /** @returns {import('@playwright/test').Locator} */
  refreshButton() {
    return this.page.getByRole('button', { name: /刷新/ })
  }

  /** @returns {import('@playwright/test').Locator} */
  wordConfigButton() {
    return this.page.getByRole('button', { name: '词库管理', exact: true })
  }

  /** @returns {import('@playwright/test').Locator} */
  logoutButton() {
    return this.page.getByRole('button', { name: /登出/ })
  }

  /** @param {string} path 截图输出路径。 */
  async screenshot(path) {
    await this.page.screenshot({ path, fullPage: true })
  }
}

module.exports = { AdminDashboard }
