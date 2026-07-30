export class RoomPage {
  constructor(page) {
    this.page = page
  }

  async waitForRoomReady() {
    await this.page.getByText('游戏房间').waitFor({ state: 'visible', timeout: 10000 })
  }

  async selectRole(roleName) {
    await this.page.getByTestId(`role-card-${roleName}`).click()
  }

  async waitForRoleSelected() {
    // "我"标签出现在某个角色卡片的 status testid 上
    await this.page.locator('[data-testid^="role-card-status-"]').filter({ hasText: '我' }).waitFor({ state: 'visible', timeout: 10000 })
  }

  async waitForChallengeButton() {
    await this.page.locator('[data-testid^="room-challenge-"]').first().waitFor({ state: 'visible', timeout: 15000 })
  }

  async clickChallenge(targetRoleOrNickname) {
    // 优先按角色 testid 定位（如"机器人"），否则按昵称文本匹配
    const byRole = this.page.getByTestId(`room-challenge-${targetRoleOrNickname}`)
    const count = await byRole.count()
    if (count > 0) {
      await byRole.click()
      return
    }
    // 昵称场景：挑战按钮文案含昵称
    await this.page.locator('[data-testid^="room-challenge-"]').filter({ hasText: targetRoleOrNickname }).click()
  }

  async waitForGameStart() {
    await this.page.getByText('第 1 局').waitFor({ state: 'visible', timeout: 15000 })
  }

  async switchToMode(mode) {
    const labels = { rps: '猜拳', arithmetic: '算术', spelling: '默写' }
    const seg = this.page.getByTestId('room-mode-segmented')
    // Ant Segmented 的可点击选项是含文本的 label 元素，用文本定位（radio input 是隐藏的不可点）
    await seg.getByText(labels[mode], { exact: false }).click()
  }

  async switchDifficulty(level) {
    await this.page.getByTestId(`room-difficulty-${level}`).click()
  }

  async deselectRole() {
    // 找到带"我"标签的角色卡片，点击该卡片取消选中（不再用 .ant-tag + DOM 父级回溯）
    const myCard = this.page.locator('[data-testid^="role-card-status-"]').filter({ hasText: '我' })
    // status 在 role-card 可点击 div 内，点击其所属卡片
    await myCard.locator('..').click()
  }
}
