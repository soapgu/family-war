/**
 * v3.6 Phase 2 步骤 2b：标记“预期失败”的生命周期缺陷用例。
 *
 * 语义对齐 client E2E 的 Playwright test.fail(condition, reason)：fn() 执行
 * 目标行为断言（不得降级为接受当前 buggy 行为）。
 *
 * - 当前有缺陷时：目标断言抛错 -> threw=true -> 用例通过（绿），把“当前是红的”
 *   这一事实钉成绿基线，缺陷被显式登记，不污染正常通过率；
 * - 2d/2e/2f/2g 修复后：目标断言通过 -> threw=false -> 用例失败（红），提示按
 *   issueId 移除 failing 标记、毕业为正式 it() 回归（2j 按 issueId 批量处理）。
 *
 * 不变量（step.md 2b 要求）：
 * - 断言内容必须是目标行为，绝不放松为接受当前 buggy 行为；
 * - 缺陷用例必须带 issueId 与原因，便于 2j 批量定位与移除。
 */
const failing = (title, issueId, reason, fn) =>
  it(`${title} [${issueId} 预期失败: ${reason}]`, async () => {
    let threw = false
    try {
      await fn()
    } catch (e) {
      threw = true
    }
    if (!threw) {
      throw new Error(
        `${issueId} 目标断言已通过，请移除 failing 标记并毕业为正式回归: ${reason}`
      )
    }
  })

module.exports = { failing }
