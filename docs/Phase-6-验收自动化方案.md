# Phase 6：管理员验收测试自动化方案

## 1. 目标

将 Phase 5 的人工浏览器验收流程（5a–5f）转化为可编程、可回归、可中断续跑的 Playwright 自动化测试，取代每次发版前的手动操作。

## 2. 目录结构

```
server/tests/acceptance/
├── runner.js                     # 步进执行器：状态管理 + 中断处理 + 报告生成
├── test-config.js                # URL/密码/截图目录等公共配置
├── playwright.config.js          # Playwright 配置（chromium only）
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
│   ├── reporter.js               # 报告写入工具
│   └── state.js                  # 状态持久化工具
└── output/                       # 自动生成，.gitignore
    ├── screenshots/              # 分步截图
    ├── state.json                # 执行进度（中断恢复用）
    ├── report.json               # 机器可读结果
    └── report.md                 # 人类可读报告
```

### 2.1 新增依赖

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

## 3. 关键机制

### 3.1 步进执行器（runner.js）

每个步骤是一个独立模块，导出以下接口：

```js
module.exports = {
  id: '5b',
  name: '认证与会话',
  async run({ page, config, reporter }) {
    // 验收逻辑
  }
}
```

`runner.js` 按顺序加载 `steps/*.js`，状态由 `lib/state.js` 管理：

```json
{
  "completed": ["5a", "5b"],
  "current": null,
  "failed": [],
  "startedAt": "2026-07-22T15:00:00Z"
}
```

### 3.2 中断与恢复

- 每个步骤执行完后立即写盘更新 `state.json`
- `process.on('SIGINT')` 捕获中断信号，保存已完成步骤后退
- 启动时读取 `state.json`，已完成的步骤跳过
- `--reset` 参数清空状态和 output 目录，从头执行

### 3.3 报告（lib/reporter.js）

提供三个操作，每次调用立即追加写入 `report.md`：

```
reporter.onStepStart(id, name)
reporter.onStepPass(id, detail)
reporter.onStepFail(id, error)
```

`report.md` 示例：

```markdown
## Phase 6 验收报告

### 5a ✅ 验收前检查
- PM2 online
- 99/99 测试通过
- 生产构建通过
- 工作区干净

### 5b ✅ 认证与会话
- 未登录拦截
- 错误密码提示
- 登录成功
- 刷新保持
- 登出

### 5c ❌ 管理仪表盘
- 状态卡片渲染失败：预期 3 张卡片，实际 0
```

`report.json` 完整结果供 CI 解析。

### 3.4 截图

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

## 4. 运行方式

```bash
# 全量运行
node server/tests/acceptance/runner.js

# 重置状态从头跑
node server/tests/acceptance/runner.js --reset

# 从指定步骤开始（跳过前面的）
node server/tests/acceptance/runner.js --from 5c
```

## 5. 验收场景对应

| 文件 | 对应步骤 | 核心验证点 |
|------|----------|-----------|
| `01-precheck.js` | 5a | PM2 online / npm test 99/99 / 构建通过 / 工作区干净 |
| `02-auth.js` | 5b | 401 弹登录 / 错误密码提示 / 正确密码登录 / cookie 持久化 / 登出 |
| `03-dashboard.js` | 5c | 状态卡片渲染 / 0 rooms/0 players/0 games / 自动刷新 |
| `04-word-config.js` | 5d | 章节开关 / 未保存提示 / 最少启用保护 / 保存后刷新验证 |
| `05-images.js` | 5e | 候选弹窗 / 选中 / 确认换图 / 预览 |
| `06-responsive.js` | 5f | 1366×768 / 1440×900 / 1920×1080 三组截图 + 控件可点击 |

## 6. 注意事项

- 验收测试依赖 PM2 预发布服务（`:4010`），不能与常规 Jest/Vitest 单元测试混跑
- 5e 换图有副作用（修改预发布图片），测试后需通过 API 恢复
- `.gitignore` 添加 `server/tests/acceptance/output/`
- `playwright.config.js` 中 `headless: true` 无头运行，失败时通过 `reporter.onStepFail` 截取现场图
