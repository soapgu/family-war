const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..')
const CLIENT_BUILD_DIR = path.join(ROOT_DIR, 'client', 'build')
const ADMIN_BUILD_DIR = path.join(ROOT_DIR, 'admin-client', 'build')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function runScript(script) {
  const result = spawnSync(npmCommand, ['run', script], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`npm run ${script} 执行失败`)
  }
}

function listFiles(directory, baseDirectory = directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name)
      if (entry.isDirectory()) return listFiles(absolutePath, baseDirectory)
      return [path.relative(baseDirectory, absolutePath)]
    })
}

function snapshot(directory) {
  return Object.fromEntries(listFiles(directory).map((relativePath) => {
    const content = fs.readFileSync(path.join(directory, relativePath))
    const digest = crypto.createHash('sha256').update(content).digest('hex')
    return [relativePath, digest]
  }))
}

function assertSameSnapshot(label, before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`${label} 在构建另一个前端时发生变化`)
  }
}

function assertBuildEntry(directory, publicBase) {
  const indexPath = path.join(directory, 'index.html')
  if (!fs.existsSync(indexPath)) {
    throw new Error(`缺少构建入口：${indexPath}`)
  }
  const html = fs.readFileSync(indexPath, 'utf8')
  if (!html.includes(`${publicBase}assets/`)) {
    throw new Error(`${indexPath} 未引用 ${publicBase}assets/`)
  }
  if (!fs.existsSync(path.join(directory, 'assets'))) {
    throw new Error(`缺少资源目录：${path.join(directory, 'assets')}`)
  }
}

function main() {
  runScript('build')

  assertBuildEntry(CLIENT_BUILD_DIR, '/family-war/')
  assertBuildEntry(ADMIN_BUILD_DIR, '/admin/')

  const adminBeforeClientBuild = snapshot(ADMIN_BUILD_DIR)
  runScript('build:client')
  assertSameSnapshot(
    'admin-client/build',
    adminBeforeClientBuild,
    snapshot(ADMIN_BUILD_DIR),
  )

  const clientBeforeAdminBuild = snapshot(CLIENT_BUILD_DIR)
  runScript('build:admin')
  assertSameSnapshot(
    'client/build',
    clientBeforeAdminBuild,
    snapshot(CLIENT_BUILD_DIR),
  )

  if (fs.existsSync(path.join(CLIENT_BUILD_DIR, 'admin'))) {
    throw new Error('检测到 client/build/admin，两个前端产物不应嵌套')
  }

  console.log('构建隔离验证通过：游戏端和管理端产物可独立、重复构建')
}

main()
