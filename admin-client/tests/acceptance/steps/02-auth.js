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
    await logoutBtn.click()
    await page.waitForTimeout(500)
    details.push('点击"登出"按钮')

    // 从浏览器上下文读取 Cookie，确认 admin_session 已删除。
    const cookies = await page.context().cookies()
    if (cookies.find(c => c.name === 'admin_session')) throw new Error('登出后 admin_session Cookie 未清除')
    details.push('admin_session Cookie 已清除')

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
    details.push(`admin_session Cookie 已设置，过期于 ${new Date(finalCookie.expires * 1000).toISOString()}`)

    reporter.onStepPass(this.id, details)
  },
}

module.exports = step
