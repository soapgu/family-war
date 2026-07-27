const { execSync } = require('child_process')

/** @type {import('../types').AcceptanceStep} */
const step = {
  id: '5a',
  name: '预检查：环境健康、管理站点、API、登录',
  requiresAuth: false,

  async run({ state, page, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    // 确认后端进程处于在线状态，避免把部署问题误判为页面问题。
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

    // 使用短超时探测 API 健康端点。
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(config.apiBaseURL + '/health', { signal: controller.signal })
      clearTimeout(timeoutId)
      const body = await res.json()
      if (body.status !== 'ok') throw new Error(`health 异常: ${JSON.stringify(body)}`)
      details.push(`GET ${config.apiPath}/health → ${JSON.stringify(body)}`)
    } catch (err) {
      throw new Error(`${config.apiPath}/health 不可达: ${err.message}`)
    }

    // 验证管理站点可以独立渲染，不依赖游戏端页面。
    await page.goto(config.adminBaseURL + '/', { waitUntil: 'networkidle' })
    const appNode = await page.locator('#root').innerHTML()
    if (!appNode || appNode.length === 0) throw new Error('管理站点渲染失败')
    details.push('独立管理站点渲染正常 (root render)')

    // 完成真实登录并等待管理首页出现。
    if (await page.locator('.ant-modal').count() > 0) {
      details.push('未登录 → 弹出密码对话框')
    }
    await page.fill('input[placeholder="请输入管理密码"]', config.adminPassword)
    const loginResponsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === `${config.authPath}/login`
        && response.request().method() === 'POST'
    )
    await page.click('button:has-text("登录")')
    const loginResponse = await loginResponsePromise
    if (!loginResponse.ok()) {
      throw new Error(`管理员登录失败: HTTP ${loginResponse.status()}`)
    }
    await page.waitForFunction(
      () => !document.querySelector('.ant-modal'),
      null,
      { timeout: 10000 }
    )
    details.push('密码登录成功，弹窗消失')
    await page.getByRole('heading', { name: '管理首页' }).waitFor({ state: 'visible' })
    details.push('管理首页可见')

    reporter.onStepPass(this.id, details)
  },
}

module.exports = step
