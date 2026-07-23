module.exports = {
  id: '5c',
  name: '后台管理首页：面板展示完整性',
  requiresAuth: true,

  async run({ state, page, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    await page.goto(config.webBaseURL + '/admin', { waitUntil: 'networkidle', timeout: 20000 })
    await page.locator('text=后台管理').waitFor({ state: 'visible', timeout: 15000 })
    details.push('头部标题 "后台管理" 可见')

    const statusApi = await page.evaluate(async () => {
      const res = await fetch('/family-war/api/admin/status')
      return res.ok ? (await res.json()) : null
    })
    if (!statusApi) throw new Error('GET /api/admin/status 响应异常')
    details.push(`GET /api/admin/status OK — ${Object.keys(statusApi).join(', ')}`)

    reporter.onStepPass(this.id, details)
  },
}
