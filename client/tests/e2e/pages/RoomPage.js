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
}
