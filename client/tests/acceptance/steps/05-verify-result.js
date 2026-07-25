const path = require('path')
const fs = require('fs')
const { GameBoardPage } = require('../pages/GameBoardPage')

module.exports = {
  id: '05',
  name: '验证赛果并截图',
  async run({ pageA, pageB, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    const boardA = new GameBoardPage(pageA, config)
    const boardB = new GameBoardPage(pageB, config)

    const resultA = await boardA.getResultText()
    const resultB = await boardB.getResultText()

    if (resultA !== 'win') throw new Error(`玩家 A 应获胜，实际: ${resultA}`)
    if (resultB !== 'lose') throw new Error(`玩家 B 应失败，实际: ${resultB}`)

    details.push(`玩家 A（小明）结果: ${resultA} ✓`)
    details.push(`玩家 B（小红）结果: ${resultB} ✓`)

    const screenshotDir = config.screenshotDir
    fs.mkdirSync(screenshotDir, { recursive: true })
    const screenshotPath = path.join(screenshotDir, 'rps-match-result.png')
    await boardA.screenshot(screenshotPath)
    details.push(`截图已保存: ${screenshotPath}`)

    if (!fs.existsSync(screenshotPath)) {
      throw new Error('截图文件未生成')
    }
    details.push('截图文件存在 ✓')

    reporter.onStepPass(this.id, details)
  },
}
