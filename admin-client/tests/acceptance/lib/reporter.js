const fs = require('fs')
const path = require('path')

/**
 * 创建同时输出 JSON 与 Markdown 的验收报告器。
 *
 * @param {string} outputDir 报告输出目录。
 * @returns {import('../types').AcceptanceReporter}
 */
function create(outputDir) {
  const jsonPath = path.join(outputDir, 'report.json')
  const mdPath = path.join(outputDir, 'report.md')

  fs.mkdirSync(outputDir, { recursive: true })

  /** @type {any} */
  let report
  try {
    report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
    report.summary = report.summary || { passed: 0, failed: 0, skipped: 0, total: 0 }
  } catch {
    report = {
      startedAt: new Date().toISOString(),
      steps: [],
      summary: { passed: 0, failed: 0, skipped: 0, total: 0 },
    }
  }

  /** 重新统计各状态步骤数量。 */
  function recalcSummary() {
    report.summary = {
      passed: report.steps.filter(s => s.status === 'passed').length,
      failed: report.steps.filter(s => s.status === 'failed').length,
      skipped: report.steps.filter(s => s.status === 'skipped').length,
      total: report.steps.length,
    }
  }

  /**
   * 将毫秒格式化为适合报告展示的时长。
   *
   * @param {number} ms 毫秒数。
   * @returns {string}
   */
  function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  /**
   * 结束报告并记录总耗时。
   *
   * @param {Date} endTime 结束时间。
   */
  function finish(endTime) {
    report.finishedAt = endTime.toISOString()
    report.durationMs = new Date(endTime) - new Date(report.startedAt)
    save()
  }

  /** 将当前报告同时写入 JSON 和 Markdown 文件。 */
  function save() {
    recalcSummary()
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8')
    const durationLine = report.durationMs != null ? `- **总耗时**: ${formatDuration(report.durationMs)}\n` : ''
    const lines = ['# Phase 6 验收报告\n', durationLine].filter(Boolean)
    for (const step of report.steps) {
      const icon = step.status === 'passed' ? '✅' : step.status === 'failed' ? '❌' : step.status === 'skipped' ? '⏭️' : '⬜'
      lines.push(`## ${step.id} ${icon} ${step.name}\n`)
      if (step.details) {
        for (const d of step.details) {
          lines.push(`- ${d}`)
        }
        lines.push('')
      }
      if (step.error) {
        lines.push(`\`\`\`\n${step.error}\n\`\`\`\n`)
      }
    }
    fs.writeFileSync(mdPath, lines.join('\n'), 'utf-8')
  }

  /**
   * @param {string} id 步骤 ID。
   * @param {string} name 步骤名称。
   */
  function onStepStart(id, name) {
    const existing = report.steps.find(s => s.id === id)
    if (!existing) {
      report.steps.push({ id, name, status: 'running', details: [], error: null })
    } else {
      existing.status = 'running'
      existing.details = []
      existing.error = null
    }
    save()
  }

  /**
   * @param {string} id 步骤 ID。
   * @param {string[]} [detailLines] 通过详情。
   */
  function onStepPass(id, detailLines) {
    const step = report.steps.find(s => s.id === id)
    if (step) {
      step.status = 'passed'
      step.details = detailLines || []
      step.error = null
    }
    save()
  }

  /**
   * @param {string} id 步骤 ID。
   * @param {string[]} detailLines 失败前收集的详情。
   * @param {unknown} [error] 错误信息。
   */
  function onStepFail(id, detailLines, error) {
    const step = report.steps.find(s => s.id === id)
    if (step) {
      step.status = 'failed'
      step.details = detailLines || []
      step.error = error ? String(error).slice(0, 500) : null
    }
    save()
  }

  /**
   * @param {string} id 步骤 ID。
   * @param {string} reason 跳过原因。
   */
  function onStepSkip(id, reason) {
    const step = report.steps.find(s => s.id === id)
    if (step) {
      step.status = 'skipped'
      step.details = [reason]
      step.error = null
    } else {
      report.steps.push({ id, name: '', status: 'skipped', details: [reason], error: null })
    }
    save()
  }

  /** @returns {import('../types').ReportSummary} */
  function getSummary() {
    recalcSummary()
    return { ...report.summary }
  }

  return { onStepStart, onStepPass, onStepFail, onStepSkip, getSummary, finish }
}

module.exports = { create }
