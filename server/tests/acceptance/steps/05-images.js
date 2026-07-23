const path = require('path')
const cleanup = require('../lib/cleanup')

module.exports = {
  id: '5e',
  name: '图片管理：浏览备选、确认替换、预览',
  requiresAuth: true,
  timeoutMs: 120000,

  async run({ state, page, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    await page.goto(config.webBaseURL + '/admin/word-config', { waitUntil: 'networkidle' })

    await page.locator('.word-config-word-row').first().waitFor({ state: 'visible', timeout: 15000 })
    details.push('词库单词列表已加载')

    const changeBtn = page.getByRole('button', { name: /更换.*图片/ }).first()
    await changeBtn.waitFor({ state: 'visible', timeout: 10000 })
    details.push('"换图" 按钮可见')

    const wordName = await page.locator('.word-config-word-name').first().innerText()
    details.push(`选中单词: "${wordName}"`)

    const imagePath = path.join(cleanup.IMAGES_DIR, `${wordName}.jpg`)
    const backupEntry = await cleanup.backupImage(wordName)
    await cleanup.registerRecovery(backupEntry)

    try {
      const candidatesResponsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/admin/word-images/candidates/')
      )
      await changeBtn.click()

      // 等待 Modal 出现
      const modal = page.locator('.ant-modal')
      await modal.waitFor({ state: 'visible', timeout: 10000 })
      const modalTitle = await modal.locator('.ant-modal-title').innerText()
      details.push(`Modal 标题: "${modalTitle}"`)

      const candidatesResponse = await candidatesResponsePromise
      const candidatesBody = await candidatesResponse.text()
      details.push(`候选接口: HTTP ${candidatesResponse.status()}`)
      if (!candidatesResponse.ok()) {
        throw new Error(`候选接口失败: HTTP ${candidatesResponse.status()} ${candidatesBody}`)
      }

      const candidateItems = modal.locator('.word-config-candidate')
      await candidateItems.first().waitFor({ state: 'visible', timeout: 10000 })
      const candidateCount = await candidateItems.count()
      details.push(`备选图片数量: ${candidateCount}`)

      if (candidateCount < 2) {
        throw new Error(`至少需要 2 张候选图片，实际 ${candidateCount}`)
      }

      // 选最后一张候选（尽量避当前图片）
      const pickIdx = candidateCount - 1
      const pickTarget = candidateItems.nth(pickIdx)
      details.push(`候选图片可见: ${await pickTarget.isVisible()}`)
      await pickTarget.click()
      await page.waitForTimeout(200)
      details.push(`已选择第 ${pickIdx + 1}/${candidateCount} 张候选图片`)

      const confirmBtn = modal.locator('button:has-text("确认换图")')
      if (!(await confirmBtn.isEnabled())) {
        throw new Error('确认换图按钮不可用')
      }
      const confirmResponsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/admin/word-images/confirm/')
      )
      await confirmBtn.click()
      details.push('已点击确认换图')

      const confirmResponse = await confirmResponsePromise
      const confirmBody = await confirmResponse.text()
      details.push(`确认接口: HTTP ${confirmResponse.status()}`)
      if (!confirmResponse.ok()) {
        throw new Error(`确认换图接口失败: HTTP ${confirmResponse.status()} ${confirmBody}`)
      }

      await modal.waitFor({ state: 'hidden', timeout: 10000 })
      details.push('图片已更换，Modal 已关闭')
      const toast = page.locator('.ant-message-notice')
      if (await toast.count() > 0) {
        details.push(`换图结果: ${await toast.innerText()}`)
      }

      // 验证新图片哈希与原始不同
      const newHash = cleanup.sha256(imagePath)
      if (!newHash) throw new Error(`换图后图片文件不存在: ${imagePath}`)
      const fs = require('fs')
      const imgStat = fs.statSync(imagePath)
      details.push(`文件 mtime: ${imgStat.mtime.toISOString()}, size: ${imgStat.size}`)
      if (newHash === backupEntry.originalHash) {
        throw new Error(`换图后图片哈希未改变: ${newHash} (size=${imgStat.size})`)
      }
      details.push(`SHA-256 ${backupEntry.originalHash.slice(0, 12)} → ${newHash.slice(0, 12)}`)
    } catch (error) {
      error.details = [...details]
      try {
        const screenshotPath = path.join(config.screenshotDir, '5e-failure.png')
        await page.screenshot({ path: screenshotPath, fullPage: true })
        error.details.push(`失败截图: ${screenshotPath}`)
      } catch {
        // 截图失败不覆盖原始错误
      }
      throw error
    } finally {
      // 恢复原图
      await cleanup.restoreImage(backupEntry)

      // 验证恢复后的哈希与原始一致
      const restoredHash = cleanup.sha256(imagePath)
      if (restoredHash !== backupEntry.originalHash) {
        throw new Error(
          `恢复后图片哈希不匹配: 期望 ${backupEntry.originalHash.slice(0, 12)}, 实际 ${restoredHash.slice(0, 12)}`
        )
      }
      details.push('恢复后 SHA-256 校验通过')

      await cleanup.removeRecovery('image', wordName)
    }

    reporter.onStepPass(this.id, details)
  },
}
