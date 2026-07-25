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
    return await this.page.isVisible('text=后台管理')
  }

  /** @returns {Promise<string[]>} 当前可见的折叠面板名称。 */
  async getVisiblePanels() {
    const panels = await this.page.$$('.ant-collapse-item')
    const names = []
    for (const panel of panels) {
      const h = await panel.$('.ant-collapse-header')
      if (h) names.push(await h.innerText())
    }
    return names
  }

  /** @param {string} path 截图输出路径。 */
  async screenshot(path) {
    await this.page.screenshot({ path, fullPage: true })
  }
}

module.exports = { AdminDashboard }
