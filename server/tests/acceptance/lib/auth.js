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
  await page.click('button:has-text("登录")')
  await page.waitForFunction(
    () => !document.querySelector('.ant-modal'),
    { timeout: 10000 }
  )
}

module.exports = { ensureAuthenticated }
