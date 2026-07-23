const path = require('path')

module.exports = {
  id: '5f',
  name: '响应式布局：1366×768、1440×900、1920×1080',
  requiresAuth: true,

  async run({ state, page, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []
    const viewports = [
      { w: 1366, h: 768, label: '1366×768' },
      { w: 1440, h: 900, label: '1440×900' },
      { w: 1920, h: 1080, label: '1920×1080' },
    ]

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.w, height: vp.h })
      await page.goto(config.webBaseURL + '/admin', { waitUntil: 'networkidle' })
      await page.waitForTimeout(500)

      const screenshotDir = config.screenshotDir || path.join(__dirname, '..', 'output/screenshots')
      await page.screenshot({ path: path.join(screenshotDir, `5f-responsive-${vp.w}x${vp.h}.png`), fullPage: true })

      const violations = []

      const maxOverflowX = await page.evaluate(() => {
        let max = 0
        for (const el of document.querySelectorAll('*')) {
          if (el.scrollWidth > el.clientWidth) {
            const rect = el.getBoundingClientRect()
            if (rect.right > document.documentElement.clientWidth + 2) {
              max = Math.max(max, el.scrollWidth - el.clientWidth)
            }
          }
        }
        return max
      })
      if (maxOverflowX > 0) violations.push(`水平溢出 ${maxOverflowX}px`)

      if (!(await page.locator('text=后台管理').isVisible())) violations.push('标题不可见')
      if (!(await page.locator('text=词库管理').isVisible())) violations.push('词库管理按钮不可见')
      if (!(await page.locator('text=刷新').isVisible())) violations.push('刷新按钮不可见')

      const cardCount = await page.locator('.ant-card').count()
      if (cardCount === 0) violations.push('统计卡片未渲染')

      if (violations.length > 0) {
        throw new Error(`[${vp.label}] ${violations.join('; ')}`)
      }
      details.push(`[${vp.label}] ✅ 无溢出，关键元素可见 (cards=${cardCount})`)
    }

    reporter.onStepPass(this.id, details)
  },
}
