import { expect } from '@playwright/test'

const CHOICE_KEYS = { '石头': 'rock', '剪刀': 'scissors', '布': 'paper' }

export class GameBoardPage {
  constructor(page) {
    this.page = page
  }

  async waitForReadyGoGone() {
    await this.page.getByTestId('rps-readygo-overlay')
      .waitFor({ state: 'detached', timeout: 5000 })
      .catch(() => {})
  }

  async waitForChoosingPhase(expectedRound) {
    await this.waitForReadyGoGone()
    // 信号 1：轮次标题 = expectedRound
    await this.page.locator('[data-testid="rps-round-title"]')
      .filter({ hasText: new RegExp(`第\\s*${expectedRound}\\s*局`) })
      .waitFor({ state: 'visible', timeout: 25000 })
    // 信号 2：rps-choice-rock 可见 + enabled
    const rock = this.page.getByTestId('rps-choice-rock')
    await rock.waitFor({ state: 'visible', timeout: 5000 })
    await expect(rock).toBeEnabled({ timeout: 5000 })
  }

  async makeChoice(labelOrKey) {
    const key = CHOICE_KEYS[labelOrKey] || labelOrKey
    await this.page.getByTestId(`rps-choice-${key}`).click()
    // 等 350ms 内部 setTimeout 完成 → phase 切到 'waiting' → button disabled
    await this.page.waitForFunction(
      (k) => {
        const btn = document.querySelector(`[data-testid="rps-choice-${k}"]`)
        return !btn || btn.disabled
      },
      key,
      { timeout: 5000 }
    )
  }

  async getRoundTitle() {
    const text = await this.page.getByTestId('rps-round-title').textContent()
    const m = text.match(/第\s*(\d+)\s*局/)
    return m ? Number(m[1]) : null
  }

  async getScore() {
    const me = await this.page.getByTestId('rps-score-me').textContent().catch(() => '0')
    const opp = await this.page.getByTestId('rps-score-opp').textContent().catch(() => '0')
    return {
      me: Number(me.match(/\d+/)?.[0] || 0),
      opp: Number(opp.match(/\d+/)?.[0] || 0),
    }
  }

  async waitForNewRound(previousRound) {
    // 等"第 N+1 局"标题 + 按钮重新 enabled（双信号，避免被 dumpState 时序污染）
    const expected = previousRound + 1
    await this.page.locator('[data-testid="rps-round-title"]')
      .filter({ hasText: new RegExp(`第\\s*${expected}\\s*局`) })
      .waitFor({ state: 'visible', timeout: 25000 })
    const rock = this.page.getByTestId('rps-choice-rock')
    await rock.waitFor({ state: 'visible', timeout: 5000 })
    await expect(rock).toBeEnabled({ timeout: 5000 })
  }

  async waitForRoundOrMatch(previousRound) {
    // 等"第 N+1 局"标题 OR `rps-match-result` 面板出现（任一即可）
    // 用于 2 胜制 + 随机对手场景：可能 i=0/i=1 就触发 match_result
    // 用 waitForFunction polling，可观察状态变化，不依赖 Promise.race 时序
    const expectedNext = previousRound + 1
    await this.page.waitForFunction(
      (expected) => {
        const match = document.querySelector('[data-testid="rps-match-result"]')
        if (match) return true
        const h4 = document.querySelector('[data-testid="rps-round-title"]')
        if (h4 && new RegExp(`第\\s*${expected}\\s*局`).test(h4.textContent)) return true
        return false
      },
      expectedNext,
      { timeout: 30000 }
    )
  }

  async waitForMatchResult() {
    const panel = this.page.getByTestId('rps-match-result')
    await panel.waitFor({ state: 'visible', timeout: 25000 })
  }

  async getMatchResultTitle() {
    return await this.page.getByTestId('rps-match-result-title').textContent()
  }

  async clickForfeit() {
    await this.page.getByTestId('rps-forfeit').click()
  }

  // 返回房间 / 重赛动作已迁移至 MatchResultPage（prefix='rps'），统一三模式赛果边界
}
