/**
 * v3.6 Phase 1 1f — 算术模式 Page Object
 *
 * 封装：等待题目 → 解析表达式 → 提交答案 → 验证反馈 → 等待赛果
 * parseAndEvaluate 是静态方法，只做安全的字符串 tokenize + Number 运算，不使用 eval。
 */
export class ArithmeticBoardPage {
  constructor(page) {
    this.page = page
  }

  async waitForQuestion() {
    await this.page.getByTestId('arithmetic-expression').waitFor({ state: 'visible', timeout: 15000 })
    await this.page.getByTestId('arithmetic-submit-btn').waitFor({ state: 'visible', timeout: 5000 })
    await this.page.waitForFunction(
      () => {
        const input = document.querySelector('[data-testid="arithmetic-answer-input"]')
        return input && !input.disabled
      },
      { timeout: 5000 }
    ).catch(() => {})
  }

  async getExpression() {
    return await this.page.getByTestId('arithmetic-expression').textContent()
  }

  /**
   * 安全解析二元表达式 "a + b = ?" 或 "a - b = ?"，返回计算结果。
   * 不依赖 page，纯字符串处理。
   * @param {string} expression - 如 "78 - 42 = ?"、"3 + 5 = ?"
   * @returns {number}
   */
  static parseAndEvaluate(expression) {
    const clean = String(expression).replace(/\s*=\s*\?$/, '').trim()
    const tokens = clean.split(/\s+/)
    if (tokens.length !== 3) return NaN
    const a = Number(tokens[0])
    const op = tokens[1]
    const b = Number(tokens[2])
    if (isNaN(a) || isNaN(b)) return NaN
    if (op === '+') return a + b
    if (op === '-') return a - b
    return NaN
  }

  async fillAnswer(value) {
    const input = this.page.getByTestId('arithmetic-answer-input')
    await input.click()
    await input.fill(String(value))
  }

  async submitAnswer() {
    await this.page.getByTestId('arithmetic-submit-btn').click()
    // 等提交按钮消失或被禁用（提交后防重复，表示答案已提交）
    await this.page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="arithmetic-submit-btn"]')
        return !btn || btn.disabled === true
      },
      { timeout: 5000 }
    ).catch(() => {
      // 正确作答时按钮可能被新题直接替换（React 批处理），超时可接受
    })
  }

  /**
   * 组合：读取表达式 → 计算答案 → 填入 → 提交
   */
  async submitCorrectAnswer() {
    const expr = await this.getExpression()
    const answer = ArithmeticBoardPage.parseAndEvaluate(expr)
    await this.fillAnswer(answer)
    await this.submitAnswer()
  }

  async waitForFeedback() {
    await this.page.getByTestId('arithmetic-feedback').waitFor({ state: 'visible', timeout: 15000 })
  }

  async isCorrect() {
    const text = await this.page.getByTestId('arithmetic-feedback').textContent()
    return text.includes('✅')
  }

  async waitForNewQuestion(prevExpression) {
    await this.page.getByTestId('arithmetic-expression').waitFor({ state: 'visible', timeout: 15000 })
    await this.page.waitForFunction(
      ([expr]) => {
        const el = document.querySelector('[data-testid="arithmetic-expression"]')
        return el && el.textContent.trim() !== expr
      },
      [prevExpression],
      { timeout: 25000 }
    )
  }

  async waitForMatchResult() {
    await this.page.getByTestId('arithmetic-match-result').waitFor({ state: 'visible', timeout: 25000 })
  }
}
