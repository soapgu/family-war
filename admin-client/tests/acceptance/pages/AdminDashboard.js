class AdminDashboard {
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  async goto() {
    await this.page.goto(this.config.adminBaseURL + '/family-war', { waitUntil: 'networkidle' })
  }

  async isVisible() {
    return await this.page.isVisible('text=后台管理')
  }

  async getVisiblePanels() {
    const panels = await this.page.$$('.ant-collapse-item')
    const names = []
    for (const panel of panels) {
      const h = await panel.$('.ant-collapse-header')
      if (h) names.push(await h.innerText())
    }
    return names
  }

  async screenshot(path) {
    await this.page.screenshot({ path, fullPage: true })
  }
}

module.exports = { AdminDashboard }
