/**
 * v3.6 Phase 1 1f — 比赛结果 Page Object（三模式共用）
 *
 * 通过 prefix 参数区分不同游戏模式的 data-testid 前缀：
 *   - 'rps'        → rps-match-result / rps-return-room-btn / ...
 *   - 'arithmetic' → arithmetic-match-result / arithmetic-return-room-btn / ...
 *   - 'spelling'   → spelling-match-result / spelling-return-room-btn / ...
 */
export class MatchResultPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {'rps'|'arithmetic'|'spelling'} prefix - data-testid 前缀
   */
  constructor(page, prefix) {
    this.page = page
    this.prefix = prefix
  }

  async waitForVisible() {
    await this.page.getByTestId(`${this.prefix}-match-result`).waitFor({ state: 'visible', timeout: 25000 })
  }

  async getTitle() {
    return await this.page.getByTestId(`${this.prefix}-match-result-title`).textContent()
  }

  /**
   * 读取排名行。仅 arithmetic/spelling 有排名块；rps 是 1v1 比分制无排名，返回空数组。
   */
  async getRanking() {
    if (this.prefix === 'rps') return []
    const container = this.page.getByTestId(`${this.prefix}-ranking`)
    const rows = container.getByTestId(`${this.prefix}-ranking-row`)
    const count = await rows.count()
    const ranking = []
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent()
      const scoreMatch = text.match(/(\d+)分/)
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0
      ranking.push({ index: i, text: text.trim(), score })
    }
    return ranking
  }

  async clickReturnRoom() {
    await this.page.getByTestId(`${this.prefix}-return-room-btn`).click()
  }

  async clickRematch() {
    await this.page.getByTestId(`${this.prefix}-rematch-btn`).click()
  }

  /**
   * RPS 模式专用的比分读取（兼容已有 GameBoardPage.getScore）
   */
  async getRpsScore() {
    const text = await this.page.getByTestId(`${this.prefix}-match-result-score`).textContent()
    const parts = text.match(/\d+/g)
    if (!parts || parts.length < 2) return { me: 0, opp: 0 }
    return { me: parseInt(parts[0], 10), opp: parseInt(parts[1], 10) }
  }
}
