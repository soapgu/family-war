async function ensureAuthenticated(page, config) {
  await page.goto(config.adminBaseURL + '/family-war', {
    waitUntil: 'networkidle',
    timeout: 15000,
  })

  const isLoggedIn = await page.evaluate(async (apiPath) => {
    try {
      const res = await fetch(`${apiPath}/admin/status`)
      return res.ok
    } catch {
      return false
    }
  }, config.apiPath)

  if (isLoggedIn) return

  await page.waitForSelector('.ant-modal', { timeout: 10000 })
  await page.fill('input[placeholder="请输入管理密码"]', config.adminPassword)
  const loginResponsePromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === `${config.apiPath}/admin/login`
      && res.request().method() === 'POST'
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
