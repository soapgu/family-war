/**
 * Unsplash 集成测试
 * 使用真实 API Key 逐词搜图+下载，验证文件落地。
 * 用法:
 *   node tests/unsplash-integration.js          # 测试后清理
 *   node tests/unsplash-integration.js --keep    # 保留图片供游戏使用
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const IMAGES_DIR = path.join(ROOT, 'public', 'images')

const config = require('../config')
if (!config.unsplashAccessKey) {
  console.log('⚠  未设置 UNSPLASH_ACCESS_KEY，跳过集成测试')
  process.exit(0)
}

const keep = process.argv.includes('--keep')
const client = require('../src/unsplashClient')

let passed = 0
let failed = 0

function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}`) }
}

function filePath(word) {
  return path.join(IMAGES_DIR, `${word}.jpg`)
}

async function run() {
  console.log('\n=== Unsplash 集成测试 ===\n')

  // ========== 1. 同步前状态 ==========

  const beforeStatus = client.getSyncStatus()
  assert(typeof beforeStatus.total === 'number' && beforeStatus.total > 0, '词库非空')

  // ========== 2. 执行同步 ==========

  console.log('\n  开始同步...\n')
  const startTime = Date.now()
  const syncResults = []

  await client.syncAll(({ word, status, error }) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    syncResults.push({ word, status, error })
    if (status === 'synced') {
      console.log(`  [${elapsed}s] ✅ ${word}`)
    } else {
      console.log(`  [${elapsed}s] ❌ ${word} — ${error}`)
    }
  })

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n  同步完成 (${totalElapsed}s)\n`)

  // ========== 3. 同步后状态验证 ==========

  const afterStatus = client.getSyncStatus()
  const syncedWords = afterStatus.words.filter((w) => w.status === 'synced')

  assert(afterStatus.total === beforeStatus.total, `单词总数 ${afterStatus.total}`)
  assert(syncedWords.length > 0, `至少 1 个单词同步成功 (${syncedWords.length}/${afterStatus.total})`)

  // ========== 4. 图片文件验证 ==========

  for (const w of syncedWords) {
    try {
      const stat = fs.statSync(filePath(w.word))
      assert(stat.size > 0, `${w.word}.jpg 存在且非空 (${stat.size} bytes)`)
    } catch {
      assert(false, `${w.word}.jpg 文件存在`)
    }
    assert(w.url === `/api/images/${w.word}`, `${w.word} URL 格式正确`)
  }

  // ========== 5. 状态与文件一致性验证 ==========

  for (const w of afterStatus.words) {
    const fileExists = fs.existsSync(filePath(w.word))
    const expectSynced = fileExists
    assert(
      (w.status === 'synced') === expectSynced,
      `${w.word} 状态(${w.status}) 与文件存在(${fileExists}) 一致`
    )
  }

  // ========== 6. 清理 ==========

  if (!keep) {
    console.log('\n  清理同步文件...')
    for (const w of afterStatus.words) {
      try { fs.unlinkSync(filePath(w.word)) } catch { /* ignore */ }
    }
    console.log('  清理完成\n')
  }

  // ========== 结果 ==========

  console.log(`\n=== Unsplash 集成测试结果 ===`)
  console.log(`  通过: ${passed}`)
  console.log(`  失败: ${failed}`)
  console.log(failed === 0 ? '\n  ✅ 全部通过\n' : `\n  ❌ ${failed} 个失败\n`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error('\n[ERROR]', err.message)
  process.exit(1)
})
