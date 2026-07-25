/** @type {import('../types').AcceptanceStep} */
const step = {
  id: '5c',
  name: '后台管理首页：面板展示完整性',
  requiresAuth: true,

  async run({ state, page, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    await page.goto(config.adminBaseURL + '/family-war', { waitUntil: 'networkidle', timeout: 20000 })
    await page.locator('text=后台管理').waitFor({ state: 'visible', timeout: 15000 })
    details.push('头部标题 "后台管理" 可见')

    // 从页面环境请求状态接口，同时验证部署后的 API 路径。
    const statusApi = await page.evaluate(async (apiPath) => {
      const res = await fetch(`${apiPath}/admin/status`)
      return res.ok ? (await res.json()) : null
    }, config.apiPath)
    if (!statusApi) throw new Error(`GET ${config.apiPath}/admin/status 响应异常`)
    details.push(`GET ${config.apiPath}/admin/status OK — ${Object.keys(statusApi).join(', ')}`)

    reporter.onStepPass(this.id, details)
  },
}

module.exports = step
