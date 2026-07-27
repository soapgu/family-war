/**
 * 确保当前页面已通过管理员认证。
 *
 * @param {import('@playwright/test').Page} page Playwright 页面。
 * @param {import('../types').AcceptanceConfig} config 验收配置。
 * @returns {Promise<void>}
 */
async function ensureAuthenticated(page, config) {
  await page.goto(config.adminBaseURL + '/family-war', {
    waitUntil: 'networkidle',
    timeout: 15000,
  })

  // 在页面上下文中请求独立身份接口，以复用浏览器 Cookie。
  const isLoggedIn = await page.evaluate(async (authPath) => {
    try {
      const res = await fetch(`${authPath}/me`)
      return res.ok
    } catch {
      return false
    }
  }, config.authPath)

  if (isLoggedIn) return

  // 未登录时完成一次真实的密码登录。
  await page.waitForSelector('.ant-modal', { timeout: 10000 })
  await page.fill('input[placeholder="请输入管理密码"]', config.adminPassword)
  const loginResponsePromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === `${config.authPath}/login`
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
