# Family War — 实现步骤

## v1.0（已完成）

**服务端**
- [x] 1. 初始化项目结构：client（CRA+rewired）、server（Koa+socket.io）、根 package.json
- [x] 2. roomManager.js — 房间 CRUD、角色分配、在线状态管理（含 24 个单元测试）
- [x] 3. gameManager.js — 猜拳判定、三局两胜赛制、平局重赛、断线结束比赛（含 19 个单元测试）
- [x] 4. handler.js — 注册所有 socket 事件（含集成测试 21 个断言验证）
- [x] 5. admin.js — GET /api/admin/status 管理接口（含对局历史记录）

**前端**
- [x] 6a. 安装 antd + 测试依赖，建空壳页面 Home/Room/Admin
- [x] 6b. 三页面 TDD 测试（空状态渲染），配置 useSocket mock
- [x] 7a. **A — 进入游戏**：Home 输入昵称 → emit room:join → GameApp 切换为 Room
- [x] 7b. **B — 角色选择**：Room + RoleCard 展示三角色，选/弃角色，实时同步
- [x] 7o1. **Home 首页优化**：渐变背景、玻璃态卡片、加载态按钮、自动聚焦
- [x] 7o2. **RoleCard 角色卡片优化**：Emoji 图标、角色专属配色
- [x] 7o3. **Room 房间页优化**：玩家在线列表、进出房间 Toast 通知
- [x] 7c. **C — 发起挑战+开局**：点击对手 → game:challenge → 进入对战
- [x] 7d. **D — 出拳+判定+赛果**：GameBoard 出拳 + MatchResult 弹窗
- [x] 7e. **E — 后台监控**：Admin 展示房间列表 + 对局历史
- [x] 7f. **F — 重赛+认输+断线**：流程闭环，边界状态处理
- [x] 7g. **G — 机器人对战**：常驻机器人角色，纯随机出牌
- [x] 8a. **UI 交互音效**：角色选中/取消、挑战冲锋号、出拳 punch、翻骰节拍
- [x] 8b. **出拳翻骰动画**：滚筒快速轮换，点击定格
- [x] 8c. **Ready Go 动画**：3 秒倒计时动效
- [x] 8d. **背景音乐系统**：大厅/对战/结算三阶段 BGM 自动切换

## v2.0 升级计划

采用三阶段策略，每阶段可独立验证。

### Phase 1: 服务端改造

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 1a | roomManager 增加 `gameMode` 字段，`getRoomState` 透传 | `roomManager.js` | ✅ |
| 1b | gameManager 新增算术引擎：`createArithmeticGame` / `generateQuestion` / `submitAnswer` | `gameManager.js` | ✅ |
| 1c | handler：`game:setMode`、`game:challenge` 按 `mode` 分流、`game:answer`、`game:question` 推送 + 20s 机器人定时器 | `handler.js` | ✅ |
| 1d | 测试：算术题目生成验证、多人抢答、机器人 20s、5 分结算、集成测试 | `__tests__/*.test.js`, `tests/integration.js` | ✅ |

### Phase 2: 客户端兼容（不改 UI）

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 2a | Room.js `onGameStart` 检查 `gameType`，算术模式显示占位信息而非 GameBoard | `Room.js` | ✅ |
| 2b | GameBoard.js 算术事件保护性 return | `GameBoard.js` | ✅ |
| 2c | MatchResult.js 拆子组件架构，RPS/算术历史格式容错 | `MatchResult.js` | ✅ |
| 2d | App.js BGM 切换兼容 `game.type === 'arithmetic'` | `App.js` | ✅ |
| 2e | 验证：全部旧测试通过，RPS 流程正常 | — | ✅ |

### Phase 3: 客户端升级

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 3a | Room.js 模式切换 Segmented + 算术启动按钮 | `Room.js` | ✅ |
| 3b | ArithmeticBoard.js（题目 + 输入框 + 排行榜 + 20s 倒计时 + 反馈） | `ArithmeticBoard.js` | ✅ |
| 3c | ArithmeticMatchResult.js 完整结算（终榜排名 + 每题回放） | `ArithmeticMatchResult.js` | ✅ |
| 3d | 音效：出题/答对/答错/机器人抢答音效 | `ArithmeticBoard.js` | ✅ |
| 3e | 验证：算术全流程测试 | — | ✅ |

---

## v2.1 部署规划

> 本节保留最初基于 CRA 的实施记录。项目已在 v2.2.0 迁移到 Vite，当前配置以 `client/vite.config.js` 和 [`docs/UPGRADE-v2.2.0.md`](docs/UPGRADE-v2.2.0.md) 为准。

### 概览

将 `family-war` 部署到 `http://localhost:8080/family-war`，分三步实施。

| 步骤 | 内容 | 前置依赖 |
|------|------|----------|
| **Step 1** | 前端 homepage + 路由改造 + 本地开发测试 | 无 |
| **Step 2** | 服务端 PM2 部署（端口 4010） | 无，可并行 |
| **Step 3** | Nginx 配置 | 依赖 Step 1 的构建产物和 Step 2 的服务端进程 |

---

### Step 1 — homepage + 路由改造 + 本地开发环境测试

**目标**：让前端构建产物感知 `/family-war` 前缀，同时开发模式不受影响。

| # | 文件 | 改动 | 说明 |
|---|------|------|------|
| 1.1 | `client/package.json` | 添加 `"homepage": "/family-war"` | CRA 构建时将静态资源路径改为 `/family-war/static/js/...` |
| 1.2 | `client/src/App.js` | ① `<BrowserRouter basename="/family-war">` ② BGM 路径改用 `process.env.PUBLIC_URL + '/bgm.mp3'` | React Router 路由相对 `/family-war` 工作；PUB_URL 在 dev 下为空 → `/bgm.mp3`，prod 下为 `/family-war` → `/family-war/bgm.mp3` |
| 1.3 | `client/src/hooks/useSocket.js` | 生产环境增加 `path: '/family-war/socket.io'` | 客户端通过 `/family-war/socket.io` 连接 nginx 再转发到后端；dev 仍走默认 `/socket.io` 直连 :4000 |
| 1.4 | `client/src/components/GameBoard.js` | `new Audio(process.env.PUBLIC_URL + '/readygo.mp3')` | 与 BGM 改法一致 |

**验收条件**

- `npm start`（dev 模式）正常，首页/选角/RPS/算术/后台均正常
- `npm run build --prefix client` 产物中资源路径为 `/family-war/static/js/...`
- `client/build/index.html` 中资源引用均为 `/family-war/...`

---

### Step 2 — 服务端 PM2 部署（端口 4010）

**目标**：服务端脱离 nodemon，用 PM2 管理预发布实例。

**端口说明**：

| 实例 | 端口 | 用途 |
|------|------|------|
| 开发 | 4000 | 开发环境，nodemon 热重载 |
| 集成测试 | 4001 | `npm run test:integration` |
| **预发布** | **4010** | PM2 管理，生产配置 |

**实施内容**

| # | 事项 | 说明 |
|---|------|------|
| 2.1 | 安装 PM2 | `npm i -g pm2`（如未安装） |
| 2.2 | 创建 `server/ecosystem.config.js` | 端口 4010，`NODE_ENV=production`，不开启 watch |
| 2.3 | 启动预发布实例 | `pm2 start server/ecosystem.config.js` |
| 2.4 | 验证 | `curl http://localhost:4010/api/health` → `{"status":"ok"}` |
| 2.5 | 日常同步 | 开发验证后 → `pm2 restart family-war-server` 更新预发布 |

**PM2 配置**（`server/ecosystem.config.js`）：

```js
module.exports = {
  apps: [{
    name: 'family-war-server',
    script: 'src/index.js',
    cwd: __dirname,
    env: { PORT: 4010, NODE_ENV: 'production' },
    instances: 1,
    exec_mode: 'fork',
    max_restarts: 5,
    error_file: '../logs/server-err.log',
    out_file: '../logs/server-out.log',
  }]
}
```

**重要**：PM2 不添加 `watch` 模式，开发时文件变更不会意外重启预发布服务。需要同步最新代码时手动执行 `pm2 restart family-war-server`。

---

### Step 3 — Nginx 配置

**目标**：添加 `/family-war` 路由，代理静态文件和 API/WebSocket 到预发布后端。

**实施内容**

| # | 事项 | 说明 |
|---|------|------|
| 3.1 | 创建 `/opt/homebrew/etc/nginx/servers/conf.d/family-war.conf` | 见下方配置 |
| 3.2 | 验证语法 | `nginx -t` |
| 3.3 | 重载 nginx | `nginx -s reload` |
| 3.4 | 全链路验证 | 访问 `http://localhost:8080/family-war/`，确认页面/API/WebSocket 均正常 |

**Nginx 配置**：

```nginx
# 301 redirect /family-war -> /family-war/
location = /family-war {
    return 302 /family-war/;
}

# 静态文件服务 + SPA fallback（BrowserRouter）
location /family-war/ {
    alias /Users/guhui/Githubs/family-war/client/build/;
    index index.html;
    try_files $uri $uri/ /family-war/index.html;
}

# API 反向代理（自动剥离 /family-war 前缀）
location /family-war/api/ {
    proxy_pass http://localhost:4010/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Socket.IO WebSocket 代理
location /family-war/socket.io/ {
    proxy_pass http://localhost:4010/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

### 环境对照总表

| 层级 | 开发环境 | 预发布环境 |
|------|----------|------------|
| 前端服务 | Vite dev server `:3000`（热更新） | Nginx `:8080/family-war/`（静态文件） |
| 后端进程 | nodemon `:4000`（自动重启） | PM2 `:4010`（手动重启） |
| API 入口 | `http://localhost:3000/api/*`（Vite 代理） | `http://localhost:8080/family-war/api/*`（nginx 反代） |
| Socket.IO | 直连 `http://{host}:4000` | nginx 反代 `/family-war/socket.io` → `:4010` |
| 配置文件 | `client/vite.config.js` | `nginx conf.d/family-war.conf` |

---

## v3.0 升级计划

### 概览

英文默写新玩法，全员抢答 + TTS 朗读 + Unsplash 图片 + 三档难度，共用 5 分赛制和 20s 机器人超时机制。词库按教材章节组织，支持词组（含空格），管理员可通过网页选择启用哪些章节/单词。

### Phase 1: 服务端改造

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 1a | 词库：纯单词数组 | `server/src/data/words.json` | ✅ |
| 1b | 新增 `unsplash-js` 依赖（服务端拉取图片 URL） | `server/package.json` | ✅ |
| 1c | gameManager 新增 `generateBlanks` / `generateSpellingQuestion` / `submitSpellingAnswer` / `handleRobotSpellingAnswer` | `gameManager.js` | ✅ |
| 1d | handler：`game:challenge` 增加 `mode==='spelling'` 分支 + robot 定时器 + answer 分流 + spelling 广播函数 | `handler.js` | ✅ |
| 1e | roomManager `setGameMode` 允许 `'spelling'`，存储 `spellingDifficulty` | `roomManager.js` | ✅ |
| 1f | 测试：spelling 集成测试（56 断言） | `tests/integration.js` | ✅ |
| 1g-1 | **新建** `config.js` 自定义配置 + `config.local.js` 本地覆盖（不上传 git）+ `unsplashClient.js`：Singleton，`syncAll()` 逐词搜索 Unsplash → 下载图片到 `server/public/images/`，`getImageUrl(word)` / `getSyncStatus()` 基于文件系统存在性检查，无持久化 JSON | `server/config.js`, `server/config.local.js`, `server/src/unsplashClient.js` | ✅ |
| 1g-2 | **新建** unsplashClient 单元测试 + 集成测试（mock + 真实 API Key 验证搜图/下载/持久化 34 断言全部通过） | `server/__tests__/unsplashClient.test.js`, `server/tests/unsplash-integration.js` | ✅ |
| 1g-3 | admin 路由新增 `GET /api/admin/word-images/status` + `POST /api/admin/word-images/sync` | `server/src/routes/admin.js` | ✅ |
| 1g-4 | `GET /api/images/:name` 路由，`fs.createReadStream` 提供本地图片 | `server/src/index.js` | ✅ |
| 1g-5 | `generateSpellingQuestion` 调用 `getImageUrl(word)` 填充 `unsplashImageUrl`（值为 `/api/images/cat.jpg` 或 `''`） | `server/src/socket/gameManager.js` | ✅ |
| 1g-6 | gameManager.test.js mock unsplashClient，验证 question 含 URL | `server/__tests__/gameManager.test.js` | ✅ |
| 1g-7 | 集成测试调整 unsplashImageUrl 断言 | `tests/integration.js` | ✅ |

### Phase 1h: 词库结构化

词库从扁平单词数组升级为按章节组织的结构，支持词组（含空格）和动态启用/禁用。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 1h-1 | words.json 重构为章节结构（含短语词组示例） | `server/src/data/words.json` | ✅ |
| 1h-2 | **新建** `wordBank.js`：加载章节词库 + 读/写 `word-config.json` 持久化启用配置 + 提供 `getAllWords()` / `getActiveWords()` / `getChapters()` / `getConfig()` / `saveConfig()` | `server/src/data/wordBank.js`, `server/src/data/word-config.json` | ✅ |
| 1h-3 | `.gitignore` 追加 `word-config.json` | `.gitignore` | ✅ |
| 1h-4 | `unsplashClient.js` 改用 `wordBank.getAllWords()` | `server/src/unsplashClient.js` | ✅ |
| 1h-5 | `gameManager.js` 改用 `wordBank.getActiveWords()`；`generateBlanks` 词组空格显示为 `·` | `server/src/socket/gameManager.js` | ✅ |
| 1h-6 | admin 路由新增 `GET/POST /api/admin/word-config` + `POST /api/admin/word-images/replace/:word` | `server/src/routes/admin.js` | ✅ |
| 1h-7 | 测试：mock wordBank 适配新结构 | `server/__tests__/gameManager.test.js`, `server/__tests__/unsplashClient.test.js` | ✅ |
| 1h-8 | 健壮性：校验词库配置并保证至少一个可用词；拒绝非法默写答案；空词库开局返回业务错误 | `wordBank.js`, `gameManager.js`, `handler.js`, `admin.js` | ✅ |

### Phase 2: 客户端兼容（不改 UI，spelling 按钮暂禁用）

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 2a | Room.js Segmented 增加 🔤 默写项；spelling 模式显示"开始比赛"按钮但设为 `disabled`（开发中） | `Room.jsx` | ✅ |
| 2b | MatchResult.js 增加 `gameType === 'spelling'` case，复用 ArithmeticMatchResult | `MatchResult.jsx` | ✅ |
| 2c | App.js BGM 切换兼容（已通过 `roomState.game.status` 通用处理，无需改动） | `App.jsx` | N/A |
| 2d | 验证：全部旧测试通过 + 客户端构建通过 | — | ✅ |

### Phase 3: 客户端升级

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 3a | **新建** `WordConfig.jsx` 统一词库管理页（章节/单词启用开关 + 至少保留一个可用词的前端防守 + 图片预览 + 同步缺失 + 手动选图翻页 + 英式英语 TTS 语音播放 + cache-busting 刷新） | `client/src/pages/WordConfig.jsx` | ✅ |
| 3b | `App.jsx` 增加 `/admin/word-config` 路由；`Admin.jsx` 增加「词库管理」导航按钮 | `App.jsx`, `Admin.jsx` | ✅ |
| 3c | SpellingBoard.jsx（Unsplash 图片 + TTS 按钮 + 填空字母格 + 输入框 + 排行榜 + 倒计时 + 音效）；结算重赛发送 `game:challenge { mode: 'spelling' }`，不使用仅支持 RPS 的 `game:rematch` | `SpellingBoard.jsx` | ⬜ |
| 3d | SpellingMatchResult.jsx（终榜排名 + 每题单词回顾） | `SpellingMatchResult.jsx` | ⬜ |
| 3e | 验证：默写全流程测试；覆盖重赛后仍为 spelling、沿用房间难度、重新读取参赛角色、比分与题目重置 | — | ⬜ |

### 后续 TODO：管理接口安全加固

当前管理接口面向家庭局域网使用，尚未设置身份认证，服务端 CORS 也允许任意来源。公网部署或开放给不可信设备前必须完成以下加固。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| S1 | 增加管理员认证机制，保护 `/api/admin/*` 和词库图片管理操作；密钥只从环境变量或本地配置读取，不提交仓库 | `server/src/routes/admin.js`, `server/config.js` | ⬜ |
| S2 | 将 CORS 从全开放改为允许来源白名单，分别配置开发、预发布环境 | `server/src/index.js`, `server/config.js` | ⬜ |
| S3 | 为修改词库、同步图片、确认换图等写操作增加权限校验、参数校验和统一错误响应 | `server/src/routes/admin.js`, `server/src/unsplashClient.js` | ⬜ |
| S4 | 限制候选图片确认接口只能处理词库内单词和可信图片地址，防止任意 URL 下载与非法文件名 | `server/src/routes/admin.js`, `server/src/unsplashClient.js` | ⬜ |
| S5 | 补充未认证、错误凭据、非法来源、越权写操作和合法管理员流程测试 | `server/__tests__/`, `server/tests/` | ⬜ |

**验收条件**

- 未认证请求不能读取管理状态或执行任何管理操作
- 非白名单来源无法跨域调用 API 或建立 Socket.IO 连接
- 非词库单词、非法文件名和非可信图片 URL 被明确拒绝
- 管理端凭据不出现在前端构建产物、日志或 Git 仓库中
- 开发、预发布环境均能通过配置启用合法管理访问

### PM2 管理命令

| 命令 | 作用 |
|------|------|
| `pm2 start server/ecosystem.config.js` | 启动预发布服务（:4010） |
| `pm2 stop family-war-server` | 停止 |
| `pm2 restart family-war-server` | 重启（同步最新代码后执行） |
| `pm2 logs family-war-server` | 查看实时日志 |
| `pm2 status` 或 `pm2 list` | 查看进程状态 |

**开机自启**（仅首次需要）：

```bash
pm2 startup    # 生成自启脚本（需要 sudo，按提示执行）
pm2 save       # 保存当前进程列表
```
