class RoomPage {
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  async waitForRoomReady() {
    await this.page.getByText('游戏房间').waitFor({ state: 'visible', timeout: 10000 })
  }

  async selectRole(roleName) {
    await this.page.locator('[data-testid="role-cards"]').getByText(roleName).click()
  }

  async waitForRoleSelected(timeout = 10000) {
    await this.page.locator('[data-testid="role-cards"]').getByText('我').waitFor({ state: 'visible', timeout })
  }

  async isRoleSelected() {
    return this.page.locator('[data-testid="role-cards"]').getByText('我').isVisible().catch(() => false)
  }

  async clickChallenge(targetNickname) {
    await this.page.locator('button').filter({ hasText: `挑战` }).filter({ hasText: targetNickname }).click()
  }

  async waitForChallengeButton(timeout = 15000) {
    await this.page.locator('button').filter({ hasText: '挑战' }).first().waitFor({ state: 'visible', timeout })
  }

  async waitForGameStart(timeout = 15000) {
    await this.page.getByText('第 1 局').waitFor({ state: 'visible', timeout })
  }
}

module.exports = { RoomPage }
