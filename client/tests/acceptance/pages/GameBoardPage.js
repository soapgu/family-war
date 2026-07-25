class GameBoardPage {
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  async waitForChoosingPhase(timeout = 15000) {
    await this.page.getByRole('button', { name: /石头/ }).waitFor({ state: 'visible', timeout })
  }

  async makeChoice(choiceLabel) {
    await this.page.getByRole('button', { name: new RegExp(choiceLabel) }).click()
  }

  async waitForRoundResult(timeout = 10000) {
    await Promise.race([
      this.page.getByText('你赢了！').waitFor({ state: 'visible', timeout }),
      this.page.getByText('你输了').waitFor({ state: 'visible', timeout }),
      this.page.getByText('平局！').waitFor({ state: 'visible', timeout }),
    ])
  }

  async waitForMatchResult(timeout = 15000) {
    await Promise.race([
      this.page.getByText('恭喜你获得比赛胜利！').waitFor({ state: 'visible', timeout }),
      this.page.getByText('比赛结束').waitFor({ state: 'visible', timeout }),
    ])
  }

  async getResultText() {
    const texts = await Promise.all([
      this.page.getByText('恭喜你获得比赛胜利！').isVisible().catch(() => false),
      this.page.getByText('比赛结束，下次加油！').isVisible().catch(() => false),
    ])
    if (texts[0]) return 'win'
    if (texts[1]) return 'lose'
    return null
  }

  async screenshot(filename) {
    await this.page.screenshot({ path: filename, fullPage: true })
  }
}

module.exports = { GameBoardPage }
