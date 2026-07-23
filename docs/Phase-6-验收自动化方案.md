# Phase 6：管理员验收测试自动化方案

## 1. 目标

将 Phase 5 的人工浏览器验收流程（5a–5f）转化为可编程、可回归、可中断续跑的 Playwright 自动化测试，取代每次发版前的手动操作。

## 2. 目录结构

```
server/tests/acceptance/
├── runner.js                     # 步进执行器：状态管理 + 中断处理 + 报告生成
├── test-config.js                # URL/密码/截图目录等公共配置
├── steps/
│   ├── 01-precheck.js            # 5a: 进程/测试/构建/工作区
│   ├── 02-auth.js                # 5b: 认证与会话
│   ├── 03-dashboard.js           # 5c: 管理仪表盘
│   ├── 04-word-config.js         # 5d: 词库配置
│   ├── 05-images.js              # 5e: 图片换图
│   └── 06-responsive.js          # 5f: 响应式布局
├── pages/
│   ├── LoginPage.js              # 登录弹窗 POM
│   ├── AdminDashboard.js         # 仪表盘 POM
│   └── WordConfigPage.js         # 词库管理 POM
├── lib/
│   ├── auth.js                   # ensureAuthenticated() + 登录/登出/状态检查
│   ├── cleanup.js                # 词库配置备份恢复 + 图片恢复 + recovery.json 管理
│   ├── reporter.js               # 报告写入工具（以 report.json 为事实源）
│   └── state.js                  # 状态持久化工具（同步原子写入）
├── recovery/                     # 持久化恢复清单（不会被 --reset 清空）
│   └── recovery.json
└── output/                       # 自动生成，.gitignore
    ├── screenshots/              # 分步截图
    ├── state.json                # 执行进度（中断恢复用）
    ├── report.json               # 机器可读结果（事实源）
    └── report.md                 # 人类可读报告（从 report.json 全量生成）
```

### 2.1 新增依赖

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

### 2.2 统一上下文

runner 通过全局上下文对象传递所有模块：

```js
{
  browser,    // Chromium Browser 实例
  context,    // BrowserContext（每个步骤独立创建，隔离 Cookie）
  page,       // 当前页面
  config,     // test-config.js 导出的配置
  reporter,   // 报告写入器
  state,      // 状态管理器
  auth,       // 认证工具
  cleanup,    // 数据恢复工具（词库配置 + 图片 + recovery.json）
  signal,     // AbortSignal（步骤超时时触发取消）
}
```

### 2.3 test-config.js 完整结构

全部通过环境变量注入，无硬编码密钥：

```js
const path = require('path')

module.exports = {
  webBaseURL: process.env.ACCEPTANCE_WEB_URL,
  apiBaseURL: process.env.ACCEPTANCE_API_URL,
  socketURL: process.env.ACCEPTANCE_SOCKET_URL,
  socketPath: process.env.ACCEPTANCE_SOCKET_PATH || '/family-war/socket.io',
  adminPassword: process.env.ACCEPTANCE_ADMIN_PASSWORD,
  headless: process.env.HEADED !== '1',
  stepTimeoutOverride: process.env.ACCEPTANCE_STEP_TIMEOUT
    ? parseInt(process.env.ACCEPTANCE_STEP_TIMEOUT, 10)
    : undefined,
  screenshotDir:
    process.env.ACCEPTANCE_SCREENSHOT_DIR ||
    path.join(__dirname, 'output/screenshots'),
}
```

启动时校验必填环境变量：

```js
for (const key of ['webBaseURL', 'apiBaseURL', 'socketURL', 'adminPassword']) {
  if (!config[key]) {
    throw new Error(`缺少验收配置：${key}`)
  }
}
```

## 3. 关键机制

### 3.1 步进执行器（runner.js）

每个步骤是一个独立模块，导出以下接口：

```js
module.exports = {
  id: '5c',
  name: '管理仪表盘',
  timeoutMs: 60_000,   // 步骤专属超时（可覆盖全局默认值）
  async run(ctx) {
    // ctx: { page, config, reporter, auth, cleanup, signal, ... }
    await ctx.auth.ensureAuthenticated(ctx.page)
  }
}
```

步骤默认超时：

| 步骤 | timeoutMs |
|------|-----------|
| 5a | 5 min |
| 5b | 60 s |
| 5c | 60 s |
| 5d | 60 s |
| 5e | 2 min |
| 5f | 60 s |

优先级：`config.stepTimeoutOverride` > `step.timeoutMs` > 上表默认值。

`runner.js` 按顺序加载 `steps/*.js`，状态由 `lib/state.js` 管理：

```json
{
  "schemaVersion": 1,
  "gitCommit": "d84f08c",
  "webBaseURL": "http://localhost:8080/family-war",
  "apiBaseURL": "http://localhost:4010",
  "planVersion": "Phase 6",
  "completed": ["5a", "5b"],
  "current": null,
  "failed": [],
  "startedAt": "2026-07-22T15:00:00Z"
}
```

启动时校验 `gitCommit`、`webBaseURL`、`apiBaseURL` 与当前环境一致，否则提示 `--reset`。

### 3.2 步骤之间的认证独立

**不依赖前序步骤的 Cookie 状态**。每个步骤独立创建 BrowserContext（隔离 Cookie）。

`ensureAuthenticated()` 行为：

- 访问 `/api/admin/status` 检查当前 Cookie 是否有效
- 若有效，直接返回
- 若失效或不存在，自动执行登录流程

每个步骤的认证策略：

| 步骤 | 认证策略 |
|------|---------|
| 5a | 不使用浏览器，不调用 |
| 5b | **不调用 `ensureAuthenticated()`**。自行创建 Context → 验证 401 弹窗 → 错误密码提示 → 正确密码登录 → 刷新保持 → 登出 → 关闭 Context。结束后不重登 |
| 5c | 开头调用 `ensureAuthenticated()` |
| 5d | 开头调用 `ensureAuthenticated()` |
| 5e | 开头调用 `ensureAuthenticated()` |
| 5f | 开头调用 `ensureAuthenticated()`，无需认证的页面部分跳过 |

### 3.3 数据恢复

#### 恢复清单（recovery.json）

持久化文件，独立于 `output/` 目录，不会被 `--reset` 清空。

```json
{
  "schemaVersion": 1,
  "pending": [
    {
      "type": "wordConfig",
      "snapshot": {
        "enabledChapters": ["1 Be good at school"],
        "disabledWords": []
      }
    },
    {
      "type": "image",
      "word": "hot dog",
      "originalPath": "/path/to/server/src/data/images/hot-dog.jpg",
      "backupPath": "/path/to/server/tests/acceptance/recovery/backups/hot-dog.jpg",
      "originalHash": "sha256:abc123..."
    }
  ]
}
```

规则：

1. **先生成备份，再写入 `recovery.json`，最后才执行有副作用的测试**
2. 成功执行的恢复项从 `pending` 中移除
3. 失败的恢复项保留在 `pending` 中供再次执行
4. `pending` 为空时删除 `recovery.json`
5. 恢复使用 `Promise.allSettled()` 逐项 try/catch，单个失败不影响其他

#### 生产者消费者模式

谁产生副作用谁登记恢复信息，runner 不负责备份：

| 步骤 | 登记 |
|------|------|
| 5d | 进入步骤时保存原始 word-config → 调用 `cleanup.registerRecovery({ type: 'wordConfig', snapshot })` |
| 5e | 进入步骤时备份图片文件 → 调用 `cleanup.registerRecovery({ type: 'image', word, originalPath, backupPath, originalHash })` |

runner 全局 finally 只调用 `cleanup.restoreRegistered()`，不亲自执行备份逻辑。

```js
try {
  await runSelectedSteps()
} finally {
  await cleanup.restoreRegistered()
  await browser.close()
}
```

#### `--restore-only`

启动时如发现 `recovery.json` 存在且有未完成项：

1. 打印警告并阻止新测试
2. 提示执行 `--restore-only`
3. `--reset` 必须先成功恢复才能清空

```bash
node server/tests/acceptance/runner.js --restore-only
```

恢复逻辑：

```js
// 读取 recovery.json
// 逐项尝试恢复（Promise.allSettled）
// 成功项从 pending 移除
// 失败项保留在 pending
// 全部完成后写入最终状态
```

#### 启动安全

runner 启动时检测 `recovery.json` 存在且有 `pending` 项 → 拒绝执行新测试 → 打印提示：

```
发现未完成的恢复项，请先执行：
  node server/tests/acceptance/runner.js --restore-only
```

### 3.4 中断与超时

#### SIGINT

- 第一次 Ctrl+C：设置 `cancelled = true`，runner 在当前步骤结束后自然退出，`finally` 执行恢复
- 第二次 Ctrl+C：强制退出进程（`process.exit(1)`），提示恢复可能不完整

#### 步骤超时

通过 `AbortController` 实现取消：

```js
const controller = new AbortController()

try {
  await runWithTimeout(
    () => step.run({ ...ctx, signal: controller.signal }),
    timeoutMs,
    () => controller.abort(),
  )
} finally {
  await context.close()
}
```

取消传播：

- Playwright 操作使用 `page.setDefaultTimeout(timeoutMs)`
- fetch 请求传入 `signal: controller.signal`
- 子进程超时主动 `child.kill()`
- Socket.IO 客户端超时 `socket.close()`

超时后的状态：

```json
{
  "completed": ["5a", "5b"],
  "current": null,
  "failed": [
    {
      "id": "5e",
      "reason": "timeout",
      "timeoutMs": 120000,
      "endedAt": "2026-07-22T16:00:00Z"
    }
  ]
}
```

处理规则：

- 超时 → 标记 `failed` → 不加入 `completed`
- 截取失败现场截图
- 关闭当前 Context、Socket、子进程
- 执行已登记的恢复
- 默认 fail-fast，停止后续步骤
- 续跑时失败步骤重新执行

如需继续后续步骤：`--continue-on-failure`

#### 状态原子写入

已完成步骤的标记写入采用 **同步原子写**：先写临时文件，再 `rename` 为 `state.json`。

```
state.saveSync(data)  // writeFileSync + rename
```

### 3.5 报告（lib/reporter.js）

**以 `report.json` 为唯一事实源**。每次状态变更后：

1. 更新 `report.json`（JSON.stringify 全量写入）
2. 根据 `report.json` 全量重新生成 `report.md`

不采用追加写入，避免续跑后重复内容。

`report.md` 示例：

```markdown
## Phase 6 验收报告

### 5a ✅ 验收前检查
- PM2 online（family-war-server）
- 健康检查 /api/health 200
- npm test 全部通过（99 passed，0 failed）
- 生产构建通过
- 工作区干净

### 5b ✅ 认证与会话
- 未登录拦截 → 弹出登录弹窗
- 错误密码提示
- 登录成功
- 刷新保持
- 登出

### 5c ❌ 管理仪表盘
- 状态卡片渲染失败：预期 3 张卡片，实际 0
```

### 3.6 截图

每个步骤在关键断言点自动截图，命名格式 `{stepId}-{序号}-{描述}.png`：

```
output/screenshots/
├── 5b-01-login-dialog.png
├── 5b-02-error-password.png
├── 5b-03-logged-in.png
├── 5c-01-dashboard.png
├── 5e-01-candidates-dialog.png
├── 5e-02-selected-candidate.png
├── 5f-01-1366x768.png
├── 5f-02-1440x900.png
└── 5f-03-1920x1080.png
```

`screenshotDir` 使用绝对路径（`test-config.js` 中已通过 `path.join(__dirname, ...)` 转换）。

## 4. 运行方式

```bash
# 全量运行
node server/tests/acceptance/runner.js

# 重置状态从头跑（必须先完成恢复）
node server/tests/acceptance/runner.js --reset

# 从指定步骤开始
node server/tests/acceptance/runner.js --from 5c

# 仅执行数据恢复
node server/tests/acceptance/runner.js --restore-only

# 超时/失败后继续后续步骤
node server/tests/acceptance/runner.js --continue-on-failure
```

runner 显式读取 `test-config.js` 中的 Playwright 配置（headless、截图路径等），不存在隐式生效的配置文件。

## 5. 验收场景对应

| 文件 | 对应步骤 | 核心验证点 |
|------|----------|-----------|
| `01-precheck.js` | 5a | PM2 进程 up / 健康检查 200 / npm test exit code 0 / 构建通过 / 工作区干净 |
| `02-auth.js` | 5b | 401 弹登录 / 错误密码提示 / 正确密码登录 / cookie 持久化 / 登出 |
| `03-dashboard.js` | 5c | 状态卡片渲染 / 创建 Socket.IO 客户端加入房间验证自动刷新 0→1→2 / finally 关闭 socket |
| `04-word-config.js` | 5d | 登记恢复清单 / 章节开关 / 未保存提示 / 最少启用保护 / 保存后刷新验证 |
| `05-images.js` | 5e | 登记恢复清单 / 候选弹窗 / 选中 / 确认换图 / 预览 / 文件系统备份 + SHA-256 校验 |
| `06-responsive.js` | 5f | 1366×768 / 1440×900 / 1920×1080 三组截图 + scrollWidth<=innerWidth + 按钮可见可点击 + 弹窗不超出视口 |

### 5a 验收前检查细则

以命令退出码为准，测试数量只用于报告：

```js
const { stdout, exitCode } = await exec('npm test')
const passedMatch = stdout.match(/(\d+)\s+passed/)
const passed = passedMatch ? Number(passedMatch[1]) : null

assert.equal(exitCode, 0)

reporter.record(
  passed === null
    ? 'npm test: exit code 0'
    : `npm test: ${passed} passed`
)
```

PM2 验证：

```js
// pm2 jlist 解析 JSON
const { pm2_env } = proc.find(p => p.name === 'family-war-server')
assert.ok(pm2_env.status === 'online')
// 健康检查
await fetch(`${config.apiBaseURL}/api/health`).then(r => assert.ok(r.ok))
```

### 5b 认证与会话细则

**不调用 `ensureAuthenticated()`**，自行完成完整认证生命周期：

```js
const browserContext = await browser.newContext()
const page = await browserContext.newPage()

try {
  // 1. 未登录访问 /admin → 重定向到 /admin → 401 → 弹出登录弹窗
  await page.goto(config.webBaseURL + '/admin')
  await loginPage.expectLoginRequired()

  // 2. 输入错误密码 → 验证错误提示
  await loginPage.loginWithWrongPassword()
  await loginPage.expectPasswordError()

  // 3. 输入正确密码 → 弹窗关闭 → 管理页面显示
  await loginPage.login(config.adminPassword)
  await dashboard.expectVisible()

  // 4. 刷新 → Cookie 持久化 → 仍是登录状态
  await page.reload()
  await dashboard.expectVisible()

  // 5. 登出 → 重新显示登录弹窗
  await dashboard.logout()
  await loginPage.expectLoginRequired()
} finally {
  await browserContext.close()
}
```

### 5c 仪表盘自动刷新验证细则

```js
await ctx.auth.ensureAuthenticated(page)

const socket = io(config.socketURL, {
  path: config.socketPath,
})

try {
  // 等待 Socket 连接成功
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('connect_error', reject)
  })

  socket.emit('room:join', {
    roomId: 'default',
    nickname: '验收测试玩家',
  })

  // 等待仪表盘自动刷新请求
  await page.waitForResponse(resp =>
    resp.url().includes('/api/admin/status') &&
    resp.status() === 200, { timeout: 10000 })

  // 服务端自动添加机器人，所以玩家数为 2
  const roomCard = page.locator('.ant-card').filter({ hasText: '在线房间' })
  await expect(roomCard).toContainText('1')

  const playerCard = page.locator('.ant-card').filter({ hasText: '在线玩家' })
  await expect(playerCard).toContainText('2')
} finally {
  socket.close()
}
```

### 5d 词库配置细则

```js
await ctx.auth.ensureAuthenticated(page)

// 保存原始配置 → 登记恢复
const originalConfig = await cleanup.saveOriginalWordConfig()
await cleanup.registerRecovery({ type: 'wordConfig', snapshot: originalConfig })

// 执行配置修改测试
// ...
```

### 5e 图片换图与恢复细则

5e 仅在 runner 与预发布服务同机运行时执行。图片通过文件系统备份恢复：

```js
await ctx.auth.ensureAuthenticated(page)

const testWord = 'hot dog'

// 备份原始图片 → 登记恢复
const backup = await cleanup.backupImage(testWord)
await cleanup.registerRecovery({
  type: 'image',
  word: testWord,
  originalPath: backup.originalPath,
  backupPath: backup.backupPath,
  originalHash: backup.originalHash,
})

// 执行换图测试
// 打开候选弹窗 → 选中 → 确认换图 → 预览
```

### 5f 响应式布局断言细则

每个尺寸至少验证：

```js
await page.setViewportSize({ width: 1366, height: 768 })

// 无水平溢出
const noOverflow = await page.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth)
expect(noOverflow).toBe(true)

// 关键控件可见可点击
await expect(page.getByRole('button', { name: '返回管理' })).toBeVisible()
await expect(page.getByRole('button', { name: '返回管理' })).toBeEnabled()

// 弹窗不超出视口（在对应步骤验证）
```

## 6. 注意事项

- 验收测试依赖 PM2 预发布服务（`:4010`），不能与常规 Jest/Vitest 单元测试混跑
- 5d 词库配置和 5e 换图有副作用，通过 `recovery.json` 持久化恢复清单管理，`--restore-only` 专门处理
- 5e 图片换图通过文件系统备份 + SHA-256 校验恢复；runner 必须与预发布服务同机运行
- `.gitignore` 添加 `server/tests/acceptance/output/` 和 `server/tests/acceptance/recovery/backups/`
- `recovery/recovery.json` 不被 `.gitignore` 排除（应提交空文件），但 `backups/` 目录必须排除
- runner 中 `headless: true` 无头运行，失败时通过 `reporter.onStepFail` 截取现场图
- 不设 `playwright.config.js`，所有配置由 `test-config.js` 显式管理，避免误以为自动生效
- `--reset` 不能绕过恢复；先 `--restore-only`，再 `--reset`
