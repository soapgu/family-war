const fs = require('fs')
const path = require('path')

function create(outputDir) {
  const jsonPath = path.join(outputDir, 'report.json')
  const mdPath = path.join(outputDir, 'report.md')

  fs.mkdirSync(outputDir, { recursive: true })

  const report = {
    startedAt: new Date().toISOString(),
    steps: [],
    summary: { passed: 0, failed: 0, skipped: 0, total: 0 },
  }

  function recalcSummary() {
    report.summary = {
      passed: report.steps.filter(s => s.status === 'passed').length,
      failed: report.steps.filter(s => s.status === 'failed').length,
      skipped: report.steps.filter(s => s.status === 'skipped').length,
      total: report.steps.length,
    }
  }

  function save() {
    recalcSummary()
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8')
    const lines = ['# 游戏端验收报告\n']
    for (const step of report.steps) {
      const icon = step.status === 'passed' ? '✅' : step.status === 'failed' ? '❌' : '⏭️'
      lines.push(`## ${step.id} ${icon} ${step.name}\n`)
      if (step.details) {
        for (const d of step.details) lines.push(`- ${d}`)
        lines.push('')
      }
      if (step.error) lines.push(`\`\`\`\n${step.error}\n\`\`\`\n`)
    }
    if (report.finishedAt) {
      const dur = report.durationMs ? `总耗时: ${report.durationMs}ms` : ''
      lines.push(`---\n通过: ${report.summary.passed} | 失败: ${report.summary.failed} | 总计: ${report.summary.total} | ${dur}\n`)
    }
    fs.writeFileSync(mdPath, lines.join('\n'), 'utf-8')
  }

  function onStepStart(id, name) {
    const existing = report.steps.find(s => s.id === id)
    if (existing) {
      existing.status = 'running'
      existing.details = []
      existing.error = null
    } else {
      report.steps.push({ id, name, status: 'running', details: [], error: null })
    }
    save()
  }

  function onStepPass(id, detailLines) {
    const step = report.steps.find(s => s.id === id)
    if (step) {
      step.status = 'passed'
      step.details = detailLines || []
      step.error = null
    }
    save()
  }

  function onStepFail(id, detailLines, error) {
    const step = report.steps.find(s => s.id === id)
    if (step) {
      step.status = 'failed'
      step.details = detailLines || []
      step.error = error ? String(error).slice(0, 500) : null
    }
    save()
  }

  function getSummary() {
    recalcSummary()
    return { ...report.summary }
  }

  function finish() {
    report.finishedAt = new Date().toISOString()
    report.durationMs = new Date(report.finishedAt) - new Date(report.startedAt)
    save()
  }

  return { onStepStart, onStepPass, onStepFail, getSummary, finish }
}

module.exports = { create }
