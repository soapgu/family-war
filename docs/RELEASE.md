# 发布流程

## v3.6.0 发布摘要

- 为三种游戏模式建立 Playwright E2E 回归基线，覆盖完整主链路与异常路径；
- 建立服务端生命周期测试基线，固定参与者/旁观者/真人/机器人/进行中/终局组合的当前与目标行为；
- 实现带 gameId 防护的统一对局清理入口（`lifecycle.js`），保证同一旧对局只清理一次，不误伤新对局；
- 修复 LIFE-001：算术/默写参赛者进行中离开或断线后取消整场、清机器人调度、通知所有在线真人参赛者；
- 修复 LIFE-002：`game:forfeit` 校验参赛者，非参赛者收"你不是本局玩家"，原对局不变；
- 收敛所有游戏事件权限与冻结错误文案，Handler 层显式授权先于 GameMode 兜底；
- 治理终局离开与重赛：终局参赛者离开清理旧终局不发通知，重赛校验调用者属于上一局且原真人仍在线；
- 补齐幂等与竞态基线，覆盖重复认输/重复离开/离开后输入/旧清理与新开局交错；
- 增加生命周期诊断日志，5 类事件记录 7 稳定字段（含 gameId），修复答题日志记录正确答案明文的脱敏违规；
- 服务端 342 项单测、Socket.IO 集成 109 项、游戏端 87 项、管理端 59 项、E2E stable 12 项、lifecycle 1 项通过；
- 构建隔离验证通过，无残留房间/对局/机器人调度；
- 当前没有独立正式环境，本版本以本机预发布完整验收作为发布依据；
- 详细结果见 `docs/acceptance/v3.6/phase-2-report.md` 和 `release-report.md`。

## v3.5.0 发布摘要

- 将管理员身份接口拆分为 `/api/admin-auth/login|me|logout`；
- 使用独立 HttpOnly `admin_session` Cookie，登录响应不向浏览器暴露 JWT；
- 管理端启动时通过 `me` 探测会话，family-war 模块只保留业务管理请求；
- 认证请求与 family-war 业务请求具有独立 API Base 和网络边界；
- 增加管理员 Token 类型、受众、签发者、来源校验、限流及失败语义测试；
- 删除 v3.2 `/family-war/api/*` 和 `/family-war/socket.io/*` Nginx 入口，不使用 301/302；
- 标准 API、图片、Socket.IO polling/WebSocket 和旧入口下线均通过真实网关验收；
- 服务端 273 项、游戏端 87 项、管理端 59 项测试和 Socket.IO 集成 95 项断言通过；
- 管理端预发布 acceptance 7/7、游戏端 E2E 8/8、生产构建及构建隔离验证通过；
- 完成旧 location 恢复及 v3.4/v3.5 管理认证回滚演练；
- 当前没有独立正式环境，本版本以本机预发布完整验收作为发布依据；
- 升级后管理员需要重新登录；回滚要求见 `docs/acceptance/v3.5/rollback.md`；
- 详细结果见 `docs/acceptance/v3.5/phase-5-report.md` 和 `release-report.md`。

## v3.4.0 发布摘要

- 将 `admin-client` 完善为注册表驱动的管理平台，首页卡片、顶部导航和模块路由使用同一份应用元数据；
- 建立 `modules/family-war/index.js` 模块公开入口，平台层不直接依赖模块内部页面和 API；
- 拆分 `AdminApp`、集中路由装配、平台首页和可复用应用入口卡片；
- 增加统一页面头部、面包屑、桌面内容宽度和导航溢出处理；
- 未知 `/admin/*` 地址显示明确 404 页面，不再自动跳回管理首页；
- 增加统一加载、空数据、可重试错误、API 错误对象和顶层渲染错误边界；
- 管理员 JWT Cookie、Koa 路由、游戏客户端、Socket.IO 和 PM2 协议保持不变；
- 管理端继续只使用 `/api/family-war/*`，不安装或连接 Socket.IO；
- 管理端 54 项单元测试、Playwright acceptance 7/7、构建隔离和新旧网关兼容测试通过；
- v3.3—v3.4 兼容日志未发现真实旧客户端，但旧 API 和 Socket.IO location 仍保留到 v3.5；
- 本版本不包含认证后端解耦、多管理员权限、微信认证或旧入口删除；
- 详细结果见 `docs/acceptance/v3.4/phase-5-report.md`。

## v3.3.0 发布摘要

- 公网 API 标准入口调整为 `/api/family-war/`；
- 公网 Socket.IO 标准入口调整为 `/socket/family-war/`；
- 页面路径继续使用 `/family-war/` 和 `/admin/`；
- 游戏端页面基址、API 基址和 Socket.IO path 已独立配置；
- 管理端全部生产请求切换到标准 API 入口，管理员 JWT Cookie 与后端协议不变；
- 默写图片通过 `/api/family-war/images/*` 加载；
- 新旧 Socket.IO 入口均通过 polling-only 和 WebSocket-only 网关验收；
- 旧 `/family-war/api/` 与 `/family-war/socket.io/` 在兼容期继续可用，并写入独立访问日志；
- Koa 内部 `/api/*`、Socket.IO `/socket.io/` 和 PM2 运行配置没有行为变更；
- 前端可通过恢复 v3.2 构建产物回滚，无需回滚服务端。
- 服务端 255 项、游戏端 87 项、管理端 25 项和 Socket.IO 集成 95 项测试通过；
- 管理端 Playwright acceptance 6/6 通过，测试词库和图片均已恢复；
- 详细结果见 `docs/acceptance/v3.3/release-report.md`。

## v3.2.0 发布摘要

- 新增独立 `admin-client`，管理页面从游戏客户端拆分；
- 新增 `/admin/` 管理站点及 Browser Router 深层路由回退；
- 游戏端不再包含管理路由，打开管理端不再建立 Socket.IO 连接；
- 根目录统一编排 server、client 和 admin-client 的开发、测试与构建；
- Playwright 管理验收迁入 `admin-client/tests/acceptance/`；
- 保持服务端代码、管理认证协议、`/family-war/api/` 和 `/family-war/socket.io` 不变；
- 服务端 255 项、游戏端 79 项、管理端 22 项和 Socket.IO 集成 95 项测试通过；
- 预发布 acceptance 6/6 通过，测试词库和图片均已恢复。

## 前置条件

- 安装 `gh` CLI：`brew install gh`
- 拥有 GitHub Personal Access Token（Scope: `repo`, `read:org`）
- 对仓库有写权限

## 方法一：使用 gh CLI（推荐）

### 1. 认证

```bash
echo "<你的token>" | gh auth login --with-token
```

Token 会自动存入系统凭据管理（macOS Keychain），后续无需重复认证。

验证是否成功：

```bash
gh auth status
```

### 2. 创建 Release

```bash
# 创建并推送 tag
git tag -a v<版本号> -m "v<版本号>"
git push origin v<版本号>

# 方式 A：简短 notes 直接传字符串
gh release create v<版本号> --title "v<版本号>" --notes "bug fix release"

# 方式 B：长 notes 用临时文件（推荐），用完即删
gh release create v<版本号> --title "v<版本号>" --notes-file /tmp/RELEASE_NOTES.md
```

> **注意**：如果用 `--notes-file`，建议用 `/tmp/RELEASE_NOTES.md` 等临时路径，**不要**提交到仓库。

## 方法二：使用 GitHub API（备选）

当 `gh` 不可用或 scope 受限时使用。

### 1. 创建并推送 tag

```bash
git tag -a v<版本号> -m "v<版本号>"
git push origin v<版本号>
```

### 2. 调用 GitHub API 创建 Release

```bash
TOKEN="<你的Personal Access Token>"
curl -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tag_name": "v<版本号>",
    "name": "v<版本号>",
    "body": "<Release Notes，支持Markdown>",
    "draft": false,
    "prerelease": false
  }' \
  https://api.github.com/repos/soapgu/family-war/releases
```

## 整理 Release Notes 的技巧

```bash
# 查看所有 commit，按类型归纳
git log --oneline --no-merges --reverse

# 按类型筛选
git log --oneline --no-merges --grep="^feat"
git log --oneline --no-merges --grep="^fix"
git log --oneline --no-merges --grep="^refactor"
```

建议按以下分类组织：
- **新功能**（feat）
- **Bug 修复**（fix）
- **重构**（refactor）
- **UI 更新**（style）
- **测试**（test）
- **文档**（docs）
- **其他**

## Token 管理建议

### 存放位置对比

| 方式 | 优点 | 缺点 |
|------|------|------|
| **macOS Keychain**（`gh auth login` 自动存储） | 安全、自动 | 仅限本机 |
| **密码管理器**（1Password / Bitwarden 等） | 跨设备同步、安全 | 每次使用需手动取出 |
| **环境变量**（`~/.zshrc`） | 方便脚本使用 | 明文存储，需确保文件权限安全 |

### 推荐做法

1. 在 [GitHub Token 设置页](https://github.com/settings/tokens) 生成 token（scope: `repo`, `read:org`）
2. 运行 `echo "<token>" | gh auth login --with-token` — `gh` 会自动保存到系统 Keychain
3. 后续只需运行 `gh release create`，无需再手动处理 token
4. token 也建议备份到密码管理器（如 1Password），以防 Keychain 丢失

### 安全提醒

- **不要**将 token 提交到 Git 仓库
- **不要**在公开场合泄露 token
- 定期到 [Token 设置页](https://github.com/settings/tokens) 检查和续期 token
- 如怀疑泄露，立即在 GitHub 上删除并重新生成
