const { execSync } = require('child_process')

async function waitForHealth(url, retries = 30) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(2000),
      })
      if (response.ok) return
    } catch {
      // 服务重启期间连接失败属于预期，继续轮询。
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('限流恢复后等待服务健康超时')
}

/** @type {import('../types').AcceptanceStep} */
const step = {
  id: '5b',
  name: '登录认证：登出 → 重定向 → 重新登录',
  requiresAuth: false,

  async run({ state, page, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    await page.goto(config.adminBaseURL + '/family-war', { waitUntil: 'networkidle' })

    // 每个步骤使用独立 BrowserContext，因此初始状态没有登录 Cookie。
    await page.waitForSelector('.ant-modal', { timeout: 10000 })
    await page.fill('input[placeholder="请输入管理密码"]', config.adminPassword)
    await page.click('button:has-text("登录")')
    await page.waitForFunction(() => !document.querySelector('.ant-modal'), null, { timeout: 10000 })
    details.push('首次登录成功')

    // 主动登出，随后验证前端和服务端共同清除了会话。
    const logoutBtn = page.locator('button:has-text("登出")')
    if (await logoutBtn.count() === 0) throw new Error('登录后未找到"登出"按钮')
    const logoutResponsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === `${config.authPath}/logout`
        && response.request().method() === 'POST'
    )
    await logoutBtn.click()
    const logoutResponse = await logoutResponsePromise
    if (!logoutResponse.ok()) throw new Error(`管理员退出失败: HTTP ${logoutResponse.status()}`)
    details.push('点击"登出"按钮')

    // 从浏览器上下文读取 Cookie，确认 admin_session 已删除。
    const cookies = await page.context().cookies()
    if (cookies.find(c => c.name === 'admin_session')) throw new Error('登出后 admin_session Cookie 未清除')
    details.push('admin_session Cookie 已清除')

    const meAfterLogout = await page.evaluate(async (authPath) => {
      const response = await fetch(`${authPath}/me`)
      return response.status
    }, config.authPath)
    if (meAfterLogout !== 401) throw new Error(`登出后 me 预期 401，实际 ${meAfterLogout}`)
    details.push('登出后 GET /api/admin-auth/me 返回 401')

    // 重新加载受保护页面，未认证用户应再次看到登录弹窗。
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('.ant-modal', { timeout: 10000 })
    details.push('登出后页面重定向到登录弹窗')

    // 校验弹窗标题，避免误把其他模态框当作登录界面。
    const modalTitle = await page.locator('.ant-modal-title').innerText()
    if (modalTitle !== '管理员登录') throw new Error(`Modal 标题异常: "${modalTitle}"`)
    details.push('Modal 标题: "管理员登录"')

    // 配置了密码时，额外验证错误密码不会关闭登录弹窗。
    if (config.adminPassword === '') {
      details.push('管理员密码为空 — 跳过错误密码测试')
    } else {
      await page.fill('input[placeholder="请输入管理密码"]', 'wrong-password')
      await page.click('button:has-text("登录")')
      await page.waitForSelector('.ant-typography-danger', { timeout: 10000 })
      if (await page.locator('.ant-modal').count() === 0) {
        throw new Error('错误密码登录后弹窗消失（预期应保持打开）')
      }
      details.push('错误密码弹窗保持打开')
      const errText = page.locator('.ant-typography-danger')
      details.push(`错误提示: "${await errText.innerText()}"`)
      await page.fill('input[placeholder="请输入管理密码"]', '')
    }

    // 使用正确密码重新登录并确认新的会话 Cookie 已写入。
    await page.fill('input[placeholder="请输入管理密码"]', config.adminPassword)
    await page.click('button:has-text("登录")')
    await page.waitForFunction(() => !document.querySelector('.ant-modal'), null, { timeout: 10000 })
    details.push('重新登录成功')

    const finalCookie = (await page.context().cookies()).find(c => c.name === 'admin_session')
    if (!finalCookie) throw new Error('重新登录后未设置 admin_session Cookie')
    if (!finalCookie.httpOnly) throw new Error('admin_session Cookie 未设置 HttpOnly')
    if (finalCookie.sameSite !== 'Lax') throw new Error(`admin_session SameSite 异常: ${finalCookie.sameSite}`)
    if (finalCookie.path !== '/') throw new Error(`admin_session Path 异常: ${finalCookie.path}`)
    details.push(`admin_session Cookie 已设置，过期于 ${new Date(finalCookie.expires * 1000).toISOString()}`)

    await page.reload({ waitUntil: 'networkidle' })
    if (await page.locator('.ant-modal').count() !== 0) {
      throw new Error('刷新后管理员会话未保持')
    }
    const meAfterRefresh = await page.evaluate(async (authPath) => {
      const response = await fetch(`${authPath}/me`)
      return response.ok ? response.json() : null
    }, config.authPath)
    if (meAfterRefresh?.admin?.role !== 'admin') {
      throw new Error('刷新后 me 未返回管理员身份')
    }
    details.push('刷新保持登录，me 返回管理员身份')

    // 清除当前会话后触发登录限流；服务重启会清空内存限流记录，但保留本轮临时配置。
    await page.evaluate(async (authPath) => {
      await fetch(`${authPath}/logout`, { method: 'POST' })
    }, config.authPath)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('.ant-modal', { timeout: 10000 })

    const rateLimitStatuses = await page.evaluate(async ({ authPath }) => {
      const statuses = []
      for (let attempt = 0; attempt < 6; attempt++) {
        const response = await fetch(`${authPath}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'acceptance-rate-limit-wrong' }),
        })
        statuses.push(response.status)
      }
      return statuses
    }, { authPath: config.authPath })
    if (
      rateLimitStatuses.slice(0, 5).some((status) => status !== 401) ||
      rateLimitStatuses[5] !== 429
    ) {
      throw new Error(`登录限流状态异常: ${rateLimitStatuses.join(', ')}`)
    }
    details.push('连续 5 次错误密码后第 6 次返回 429')

    execSync('pm2 restart family-war-server', { stdio: 'inherit' })
    await waitForHealth(config.apiBaseURL)

    await page.fill('input[placeholder="请输入管理密码"]', config.adminPassword)
    await page.click('button:has-text("登录")')
    await page.waitForFunction(() => !document.querySelector('.ant-modal'), null, { timeout: 10000 })
    details.push('服务重启清除内存限流后可重新登录')

    reporter.onStepPass(this.id, details)
  },
}

module.exports = step
