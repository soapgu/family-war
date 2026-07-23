async function ensureAuthenticated(page, config) {
  const response = await page.goto(config.webBaseURL + '/admin', {
    waitUntil: 'networkidle',
    timeout: 15000,
  })

  const isLoggedIn = await page.evaluate(async () => {
    try {
      const res = await fetch('/family-war/api/admin/status')
      return res.ok
    } catch {
      return false
    }
  })

  if (isLoggedIn) return

  await page.waitForSelector('.ant-modal', { timeout: 10000 })
  await page.fill('input[placeholder="请输入管理密码"]', config.adminPassword)
  const loginResponsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/admin/login') && res.request().method() === 'POST'
  )
  await page.click('button:has-text("登录")')
  const loginResponse = await loginResponsePromise
  if (!loginResponse.ok()) {
    const body = await loginResponse.json().catch(() => ({}))
    throw new Error(
      `管理员登录失败: HTTP ${loginResponse.status()} ${body.error || loginResponse.statusText()}`
    )
  }
  await page.waitForFunction(
    () => !document.querySelector('.ant-modal'),
    null,
    { timeout: 10000 }
  )
}

module.exports = { ensureAuthenticated }
