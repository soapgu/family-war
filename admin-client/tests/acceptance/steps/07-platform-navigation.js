const { AdminPlatform } = require('../pages/AdminPlatform')

/** @type {import('../types').AcceptanceStep} */
const step = {
  id: '5g',
  name: '平台导航：应用卡片、层级导航、历史记录、深层刷新与 404',
  requiresAuth: true,

  async run({ page, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []
    const platform = new AdminPlatform(page, config)

    await platform.gotoHome()
    await platform.homeHeading().waitFor({ state: 'visible' })
    const card = platform.familyWarCard()
    await card.waitFor({ state: 'visible' })
    details.push('平台首页与 Family War 应用卡片可见')

    await card.getByRole('button', { name: '进入管理', exact: true }).click()
    await page.getByRole('heading', { name: '后台管理', exact: true }).waitFor()
    if (!(await platform.navigationItem('Family War').getAttribute('class')).includes('ant-menu-item-selected')) {
      throw new Error('Family War 模块页未保持平台导航选中状态')
    }
    details.push('应用卡片进入模块，Family War 导航正确选中')

    await page.getByRole('button', { name: '词库管理', exact: true }).click()
    await page.getByRole('heading', { name: '词库管理', exact: true }).waitFor()
    const breadcrumbs = await platform.breadcrumbLabels()
    if (breadcrumbs.join(' > ') !== '管理首页 > Family War > 词库管理') {
      throw new Error(`词库面包屑异常: ${breadcrumbs.join(' > ')}`)
    }
    details.push(`词库面包屑: ${breadcrumbs.join(' > ')}`)

    await page.goBack({ waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: '后台管理', exact: true }).waitFor()
    await page.goForward({ waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: '词库管理', exact: true }).waitFor()
    details.push('浏览器后退与前进保持正确页面层级')

    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: '词库管理', exact: true }).waitFor()
    details.push('词库深层链接刷新正常')

    await platform.gotoPath('/family-war/missing-page')
    await page.getByText('页面不存在', { exact: true }).waitFor()
    if (!page.url().endsWith('/admin/family-war/missing-page')) {
      throw new Error(`404 页面掩盖了错误地址: ${page.url()}`)
    }
    await page.getByRole('link', { name: '返回管理首页' }).click()
    await platform.homeHeading().waitFor()
    details.push('未知地址显示明确 404，并可返回管理首页')

    reporter.onStepPass(this.id, details)
  },
}

module.exports = step
