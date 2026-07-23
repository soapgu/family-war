const { WordConfigPage } = require('../pages/WordConfigPage')
const cleanup = require('../lib/cleanup')
const path = require('path')

module.exports = {
  id: '5d',
  name: '词库配置：浏览单词、开关切换、保存、刷新',
  requiresAuth: true,

  async run({ state, page, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    const wcPage = new WordConfigPage(page, config)
    await wcPage.navigate()
    details.push('进入词库管理页面')

    const chapterCount = await wcPage.getChapterCount()
    if (chapterCount === 0) {
      details.push('词库为空 — 跳过开关/保存测试')
      reporter.onStepPass(this.id, details)
      return
    }
    details.push(`章节数量: ${chapterCount}`)

    const wordCount = await wcPage.getWordCount()
    details.push(`单词总行数: ${wordCount}`)

    // 备份当前词库配置
    await cleanup.backupWordConfig()
    await cleanup.registerRecovery({
      type: 'wordConfig',
      backupPath: path.join(__dirname, '..', 'recovery', 'backups', 'word-config-backup.json'),
    })
    details.push('词库配置已备份')

    // 找到第一个可操作的单词（独立变量，不复用循环变量）
    let target = null
    for (let ci = 0; ci < chapterCount && !target; ci++) {
      const chapterToggle = await wcPage.getChapterToggle(ci)
      if (chapterToggle === null) continue
      const wc = await wcPage.getWordCount(ci)
      for (let wi = 0; wi < Math.min(wc, 50); wi++) {
        const sw = await wcPage.getWordSwitchState(ci, wi)
        if (sw !== null) {
          target = { chapterIndex: ci, wordIndex: wi, word: await wcPage.getWordText(ci, wi) }
          break
        }
      }
    }

    if (!target) {
      details.push('未找到可操作的单词（非阻塞）')
      await wcPage.clickSave()
      await wcPage.clickRefresh()
      reporter.onStepPass(this.id, details)
      return
    }

    const { chapterIndex: ci, wordIndex: wi } = target
    details.push(`选中单词: "${target.word}" (章节 ${ci}, 索引 ${wi})`)

    // 记录原始状态
    const originalState = await wcPage.getWordSwitchState(ci, wi)
    details.push(`原始开关: ${originalState}`)

    // 切换 → 保存 → 刷新 → 验证持久化
    await wcPage.toggleWord(ci, wi)
    const toggledState = await wcPage.getWordSwitchState(ci, wi)
    details.push(`切换后: ${originalState} → ${toggledState}`)
    if (toggledState === originalState) {
      throw new Error(`单词 "${target.word}" 开关切换无效 (${originalState} → ${toggledState})`)
    }

    if (await page.locator('text=有未保存的修改').count() > 0) {
      details.push('未保存提示出现')
    }

    await wcPage.clickSave()
    const saveResult = await wcPage.getSaveResult()
    details.push(`保存配置结果: ${saveResult || '无消息'}`)

    // 刷新后检查状态持久化
    await wcPage.clickRefresh()
    await page.waitForTimeout(500)
    const refreshedState = await wcPage.getWordSwitchState(ci, wi)
    if (refreshedState !== toggledState) {
      throw new Error(`刷新后状态变更: 期望 ${toggledState}, 实际 ${refreshedState}`)
    }
    details.push(`刷新后状态保持: ${refreshedState} — 持久化验证通过`)

    // 恢复原始状态
    await wcPage.toggleWord(ci, wi)
    const restoreState = await wcPage.getWordSwitchState(ci, wi)
    if (restoreState !== originalState) {
      throw new Error(`恢复失败: 期望 ${originalState}, 实际 ${restoreState}`)
    }
    details.push('恢复原始状态 — 开关翻转双稳态验证通过')

    await wcPage.clickSave()
    details.push('原始配置已保存恢复')

    // 从文件级备份恢复整个 word-config → 确保完全干净
    const backupPath = path.join(__dirname, '..', 'recovery', 'backups', 'word-config-backup.json')
    await cleanup.restoreWordConfig(backupPath)
    await cleanup.removeRecovery('wordConfig')
    details.push('从文件备份完整恢复词库配置')

      reporter.onStepPass(this.id, details)
      return
  },
}
