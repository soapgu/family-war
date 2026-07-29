export class RoomPage {
  constructor(page) {
    this.page = page
  }

  async waitForRoomReady() {
    await this.page.getByText('游戏房间').waitFor({ state: 'visible', timeout: 10000 })
  }

  async selectRole(roleName) {
    await this.page.locator('[data-testid="role-cards"]').getByText(roleName).click()
  }

  async waitForRoleSelected() {
    await this.page.locator('[data-testid="role-cards"]').getByText('我').waitFor({ state: 'visible', timeout: 10000 })
  }

  async waitForChallengeButton() {
    await this.page.locator('button').filter({ hasText: '挑战' }).first().waitFor({ state: 'visible', timeout: 15000 })
  }

  async clickChallenge(targetNickname) {
    await this.page.locator('button').filter({ hasText: '挑战' }).filter({ hasText: targetNickname }).click()
  }

  async waitForGameStart() {
    await this.page.getByText('第 1 局').waitFor({ state: 'visible', timeout: 15000 })
  }

  async switchToMode(mode) {
    const labels = { rps: '猜拳', arithmetic: '算术', spelling: '默写' }
    const seg = this.page.getByTestId('room-mode-segmented')
    await seg.locator('.ant-segmented-item').filter({ hasText: labels[mode] }).click()
  }

  async switchDifficulty(level) {
    await this.page.getByTestId(`room-difficulty-${level}`).click()
  }

  async deselectRole() {
    const myCard = this.page.getByTestId('role-cards').locator('.ant-tag').filter({ hasText: '我' })
    await myCard.locator('..').locator('..').click()
  }
}
