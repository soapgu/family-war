export class GameBoardPage {
  constructor(page) {
    this.page = page
  }

  async waitForChoosingPhase() {
    await this.page.getByRole('button', { name: /石头/ }).waitFor({ state: 'visible', timeout: 15000 })
  }

  async makeChoice(choiceLabel) {
    await this.page.getByRole('button', { name: new RegExp(choiceLabel) }).click()
  }

  async waitForRoundResult() {
    await Promise.race([
      this.page.getByText('你赢了！').waitFor({ state: 'visible', timeout: 10000 }),
      this.page.getByText('你输了').waitFor({ state: 'visible', timeout: 10000 }),
      this.page.getByText('平局！').waitFor({ state: 'visible', timeout: 10000 }),
    ])
  }

  async waitForMatchResult() {
    await this.page.getByRole('button', { name: '返回房间' }).waitFor({ state: 'visible', timeout: 15000 })
  }
}
