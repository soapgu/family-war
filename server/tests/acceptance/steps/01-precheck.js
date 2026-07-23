const { execSync } = require('child_process')

module.exports = {
  id: '5a',
  name: '预检查：环境健康、API、构造版本号、登录',
  requiresAuth: false,

  async run({ state, page, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    // PM2 状态
    try {
      const pm2Out = execSync('pm2 show family-war-server --no-color 2>/dev/null || true', {
        encoding: 'utf-8',
        timeout: 5000,
      })
      if (pm2Out.includes('online')) {
        details.push('PM2 family-war-server 状态: online')
      } else {
        throw new Error('PM2 family-war-server 未运行或状态异常')
      }
    } catch (err) {
      if (err.message.includes('未运行')) throw err
      throw new Error(`PM2 检查失败: ${err.message}`)
    }

    // API health
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(config.apiBaseURL + '/api/health', { signal: controller.signal })
      clearTimeout(timeoutId)
      const body = await res.json()
      if (body.status !== 'ok') throw new Error(`health 异常: ${JSON.stringify(body)}`)
      details.push(`GET /api/health → ${JSON.stringify(body)}`)
    } catch (err) {
      throw new Error(`/api/health 不可达: ${err.message}`)
    }

    // 主页渲染
    await page.goto(config.webBaseURL, { waitUntil: 'networkidle' })
    const appNode = await page.locator('#root').innerHTML()
    if (!appNode || appNode.length === 0) throw new Error('主页渲染失败')
    details.push('主页渲染正常 (root render)')

    // 版本号
    const versionEl = page.locator('text=v3.')
    if (await versionEl.count() > 0) {
      details.push(`版本号页内可见: ${await versionEl.first().innerText()}`)
    } else {
      throw new Error('页面上未找到 v3.x 版本号')
    }

    // 管理员登录
    await page.goto(config.webBaseURL + '/admin', { waitUntil: 'networkidle' })
    if (await page.locator('.ant-modal').count() > 0) {
      details.push('未登录 → 弹出密码对话框')
    }
    await page.fill('input[placeholder="请输入管理密码"]', config.adminPassword)
    await page.click('button:has-text("登录")')
    await page.waitForFunction(() => !document.querySelector('.ant-modal'), { timeout: 10000 })
    details.push('密码登录成功，弹窗消失')

    reporter.onStepPass(this.id, details)
  },
}
