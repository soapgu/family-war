/** 管理平台首页、导航和页面层级的页面对象。 */
class AdminPlatform {
  /**
   * @param {import('@playwright/test').Page} page Playwright 页面。
   * @param {import('../types').AcceptanceConfig} config 验收配置。
   */
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  /** 打开平台首页。 */
  async gotoHome() {
    await this.page.goto(`${this.config.adminBaseURL}/`, { waitUntil: 'networkidle' })
  }

  /** 打开相对于 /admin 的深层地址。 */
  async gotoPath(path) {
    await this.page.goto(`${this.config.adminBaseURL}${path}`, { waitUntil: 'networkidle' })
  }

  /** @returns {import('@playwright/test').Locator} */
  homeHeading() {
    return this.page.getByRole('heading', { name: '管理首页', exact: true })
  }

  /** @returns {import('@playwright/test').Locator} */
  familyWarCard() {
    return this.page.locator('.admin-app-card').filter({ hasText: 'Family War' })
  }

  /** @returns {import('@playwright/test').Locator} */
  navigationItem(name) {
    return this.page.getByRole('menuitem', { name: new RegExp(`${name}$`) })
  }

  /** @returns {Promise<string[]>} */
  async breadcrumbLabels() {
    return this.page.locator('.page-breadcrumb .ant-breadcrumb-link').allInnerTexts()
  }
}

module.exports = { AdminPlatform }
