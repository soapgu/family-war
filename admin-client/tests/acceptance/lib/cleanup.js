const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const RECOVERY_DIR = path.join(__dirname, '..', 'recovery')
const RECOVERY_FILE = path.join(RECOVERY_DIR, 'recovery.json')
const SERVER_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'server')
const IMAGES_DIR = path.join(SERVER_DIR, 'public', 'images')
const WORD_CONFIG_SRC = path.join(SERVER_DIR, 'src', 'data', 'word-config.json')

/** @returns {import('../types').RecoveryData} */
function loadRecovery() {
  try {
    return JSON.parse(fs.readFileSync(RECOVERY_FILE, 'utf-8'))
  } catch {
    return { schemaVersion: 1, pending: [] }
  }
}

/** @param {import('../types').RecoveryData} data */
function saveRecovery(data) {
  fs.mkdirSync(RECOVERY_DIR, { recursive: true })
  const tmp = RECOVERY_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, RECOVERY_FILE)
}

/** @returns {boolean} */
function hasPending() {
  const r = loadRecovery()
  return r.pending.length > 0
}

/**
 * 登记一项需要在测试结束时恢复的数据变更。
 *
 * @param {import('../types').RecoveryEntry} entry 恢复项。
 */
async function registerRecovery(entry) {
  const r = loadRecovery()
  if (!r.pending.find((e) => e.type === entry.type && e.word === entry.word)) {
    r.pending.push(entry)
  }
  saveRecovery(r)
}

/**
 * 删除已经完成的恢复登记。
 *
 * @param {import('../types').RecoveryEntry['type']} type 恢复类型。
 * @param {string} [identifier] 图片单词标识。
 */
async function removeRecovery(type, identifier) {
  const r = loadRecovery()
  r.pending = r.pending.filter((e) => {
    if (type === 'wordConfig') return e.type !== 'wordConfig'
    if (type === 'image') return !(e.type === 'image' && e.word === identifier)
    return true
  })
  if (r.pending.length === 0) {
    try { fs.unlinkSync(RECOVERY_FILE) } catch {}
  } else {
    saveRecovery(r)
  }
}

/**
 * 并行执行全部待恢复项，并保留失败项供下次重试。
 *
 * @returns {Promise<{succeeded: import('../types').RecoveryEntry[], failed: import('../types').RecoveryEntry[]} | undefined>}
 */
async function restoreRegistered() {
  const r = loadRecovery()
  if (r.pending.length === 0) return

  const results = await Promise.allSettled(
    r.pending.map(async (entry) => {
      if (entry.type === 'wordConfig') {
        await restoreWordConfig(entry.backupPath)
      } else if (entry.type === 'image') {
        await restoreImage(entry)
      }
    })
  )

  const failed = []
  const succeeded = []
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      succeeded.push(r.pending[i])
    } else {
      failed.push(r.pending[i])
    }
  }

  r.pending = failed
  if (r.pending.length === 0) {
    try { fs.unlinkSync(RECOVERY_FILE) } catch {}
  } else {
    saveRecovery(r)
  }

  if (succeeded.length > 0) {
    console.log(`恢复成功：${succeeded.map((s) => s.type).join(', ')}`)
  }
  if (failed.length > 0) {
    console.error(`恢复失败：${failed.map((f) => f.type).join(', ')}，请手动处理`)
    console.error(JSON.stringify(failed, null, 2))
  }

  return { succeeded, failed }
}

/** @returns {Promise<import('../types').WordConfigRecoveryEntry>} */
async function backupWordConfig() {
  const backupDir = path.join(RECOVERY_DIR, 'backups')
  fs.mkdirSync(backupDir, { recursive: true })
  const dest = path.join(backupDir, 'word-config-backup.json')
  if (fs.existsSync(WORD_CONFIG_SRC)) {
    fs.copyFileSync(WORD_CONFIG_SRC, dest)
  }
  return { type: 'wordConfig', backupPath: dest }
}

/** @param {string} backupPath */
async function restoreWordConfig(backupPath) {
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, WORD_CONFIG_SRC)
  }
}

/**
 * 备份指定单词的本地图片及原始哈希。
 *
 * @param {string} word 单词名。
 * @returns {Promise<import('../types').ImageRecoveryEntry>}
 */
async function backupImage(word) {
  const filePath = path.join(IMAGES_DIR, `${word}.jpg`)
  const backupDir = path.join(RECOVERY_DIR, 'backups')
  fs.mkdirSync(backupDir, { recursive: true })
  const backupPath = path.join(backupDir, `${word}.jpg`)

  let originalHash = ''
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath)
    originalHash = sha256(filePath)
  }

  return { type: 'image', word, originalPath: filePath, backupPath, originalHash }
}

/** @param {import('../types').ImageRecoveryEntry} entry */
async function restoreImage(entry) {
  if (entry.originalHash === '') {
    // 原图不存在 → 删除测试创建的文件
    if (fs.existsSync(entry.originalPath)) {
      fs.unlinkSync(entry.originalPath)
    }
  } else if (fs.existsSync(entry.backupPath)) {
    fs.copyFileSync(entry.backupPath, entry.originalPath)
    const hash = sha256(entry.originalPath)
    if (hash !== entry.originalHash) {
      throw new Error(`SHA-256 不匹配：${entry.word}`)
    }
  }
}

/**
 * 计算文件的 SHA-256；文件不存在时返回空字符串。
 *
 * @param {string} filePath 文件路径。
 * @returns {string}
 */
function sha256(filePath) {
  if (!fs.existsSync(filePath)) return ''
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

module.exports = {
  hasPending,
  registerRecovery,
  removeRecovery,
  restoreRegistered,
  backupWordConfig,
  restoreWordConfig,
  backupImage,
  restoreImage,
  sha256,
  IMAGES_DIR,
}
