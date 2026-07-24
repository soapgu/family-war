module.exports = {
  id: '5b',
  name: '登录认证：登出 → 重定向 → 重新登录',
  requiresAuth: false,

  async run({ state, page, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    await page.goto(config.adminBaseURL + '/family-war', { waitUntil: 'networkidle' })

    // 先登录（独立 Context 初始无 Cookie）
    await page.waitForSelector('.ant-modal', { timeout: 10000 })
    await page.fill('input[placeholder="请输入管理密码"]', config.adminPassword)
    await page.click('button:has-text("登录")')
    await page.waitForFunction(() => !document.querySelector('.ant-modal'), null, { timeout: 10000 })
    details.push('首次登录成功')

    // 点击"登出"按钮
    const logoutBtn = page.locator('button:has-text("登出")')
    if (await logoutBtn.count() === 0) throw new Error('登录后未找到"登出"按钮')
    await logoutBtn.click()
    await page.waitForTimeout(500)
    details.push('点击"登出"按钮')

    // 验证 Cookie 清除
    const cookies = await page.context().cookies()
    if (cookies.find(c => c.name === 'admin_token')) throw new Error('登出后 admin_token Cookie 未清除')
    details.push('admin_token Cookie 已清除')

    // 重新加载 → 弹窗
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('.ant-modal', { timeout: 10000 })
    details.push('登出后页面重定向到登录弹窗')

    // 验证 Modal 标题
    const modalTitle = await page.locator('.ant-modal-title').innerText()
    if (modalTitle !== '管理员登录') throw new Error(`Modal 标题异常: "${modalTitle}"`)
    details.push('Modal 标题: "管理员登录"')

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

    // 重新登录
    await page.fill('input[placeholder="请输入管理密码"]', config.adminPassword)
    await page.click('button:has-text("登录")')
    await page.waitForFunction(() => !document.querySelector('.ant-modal'), null, { timeout: 10000 })
    details.push('重新登录成功')

    const finalCookie = (await page.context().cookies()).find(c => c.name === 'admin_token')
    if (!finalCookie) throw new Error('重新登录后未设置 admin_token Cookie')
    details.push(`admin_token Cookie 已设置，过期于 ${new Date(finalCookie.expires * 1000).toISOString()}`)

    reporter.onStepPass(this.id, details)
  },
}
