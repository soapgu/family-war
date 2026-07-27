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
| 1f | 测试：spelling 集成测试（当前完整 Socket 流程共 61 断言） | `tests/integration.js` | ✅ |
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
| 3c | SpellingBoard.jsx（Unsplash 图片 + 自动/手动英式 TTS + 填空字母格 + 输入框 + 排行榜 + 倒计时 + 音效 + 内联批改）；Room 开放三档难度和启动入口；结算重赛发送 `game:challenge { mode: 'spelling' }`，不使用仅支持 RPS 的 `game:rematch` | `SpellingBoard.jsx`, `Room.jsx` | ✅ |
| 3d | SpellingMatchResult.jsx（终榜排名 + 每题单词、填空提示和玩家答案回顾） | `SpellingMatchResult.jsx` | ✅ |
| 3e | 验证：默写完整 5 分流程；覆盖重赛后仍为 spelling、沿用房间难度、重新读取参赛角色、比分与题目重置，以及旧结算页跨模式重赛保护 | `server/tests/integration.js`, `client/src/__tests__/SpellingMatchResult.test.jsx` | ✅ |

---

## v3.1 升级计划

### 概览

v3.1 聚焦 v3.0 发布后的架构债、安全债和联机稳定性：在不新增大玩法的前提下，重构服务端游戏抽象，统一机器人自动回复时间配置，补齐管理接口安全边界，并改善客户端断线重连后的房间恢复体验。

### Phase 1: 游戏服务端架构重构

目标：将最初围绕石头剪子布设计的 `gameManager` / `handler` 整理为可承载多游戏模式的结构。`RoomManager` 当前职责仍较清晰，以检查和小幅整理为主，不作为本阶段大拆对象。

详细设计见：[V3.1-Phase 1-游戏服务端架构重构.md](V3.1-Phase%201-%E6%B8%B8%E6%88%8F%E6%9C%8D%E5%8A%A1%E7%AB%AF%E6%9E%B6%E6%9E%84%E9%87%8D%E6%9E%84.md)

核心结构采用 class 继承：

```txt
BaseGameMode
├── RpsGameMode
└── QuizGameMode
    ├── ArithmeticGameMode
    └── SpellingGameMode
```

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 1a | 完成 Phase 1 详细设计定稿：确定 class 继承结构、目录、核心接口、命名、返回结构、实施顺序和边界 | `V3.1-Phase 1-游戏服务端架构重构.md` | ✅ |
| 1b | 新建 `games/` 目录与 `BaseGameMode`，提供 `createBaseGame`、`buildRanking`、`buildPlayerList`、胜利分数和默认抽象方法 | `server/src/socket/games/BaseGameMode.js` | ✅ |
| 1c | 拆分 RPS 为 `RpsGameMode`，保留 1v1 出拳、平局、三局两胜、机器人即时随机出拳和每人视角 payload | `server/src/socket/games/RpsGameMode.js` | ✅ |
| 1d | 新建 `gameRegistry`，定义默认配置、合并外部配置、创建并管理 GameMode 实例（含 `get`/`has`/`list`） | `server/src/socket/games/gameRegistry.js` | ✅ |
| 1e | 迁移 RPS 调用链：`gameManager.submitMove` 改为通过 `RpsGameMode`；兼容壳 `toLegacyResult` 转换嵌套结果为旧平铺格式 | `server/src/socket/gameManager.js` | ✅ |
| 1f | 新建 `QuizGameMode` 中间基类，抽象算术/默写共用的出题抢答流程：每题一次、答错 waiting、答对加分、5 分结算、机器人提交正确答案 | `server/src/socket/games/QuizGameMode.js` | ✅ |
| 1g | 拆分算术为 `ArithmeticGameMode`，迁移题目生成、数字答案校验、轮结算、赛果和题目 payload 构建 | `server/src/socket/games/ArithmeticGameMode.js` | ✅ |
| 1h | 迁移算术调用链：`submitArithmeticAnswer` / `generateQuestion` / `handleRobotArithmeticAnswer` 改为保持旧平铺返回格式的兼容壳 | `server/src/socket/gameManager.js` | ✅ |
| 1i | 拆分默写为 `SpellingGameMode`，迁移词库取词、填空生成、图片 URL、难度、答案校验、轮结算、赛果和题目 payload 构建 | `server/src/socket/games/SpellingGameMode.js` | ✅ |
| 1j | 迁移默写调用链：`submitSpellingAnswer` / `generateSpellingQuestion` / `handleRobotSpellingAnswer` 改为兼容壳，gameManager 接入 gameRegistry | `server/src/socket/gameManager.js`, `server/src/socket/games/gameRegistry.js` | ✅ |
| 1k | 抽出 `robotScheduler`，统一管理 `schedule` / `clear` / `getEndAt` / `getRemainingMs` / `accelerate` / `clearAll`；保留默写全部人类答错后将机器人剩余等待缩短至 5 秒的规则 | `server/src/socket/robotScheduler.js`, `server/src/socket/handler.js` | ✅ |
| 1l | 精简 `handler`：保留事件注册、房间校验、调用、广播和调度；统一游戏取消、房间删除、赛果后的 scheduler 清理，且算术/默写仍继续时不因单人断线误清定时器 | `server/src/socket/handler.js` | ✅ |
| 1m | 补充/迁移 GameMode 单元测试，覆盖三种游戏、旧 API 返回格式、RPS 历史、配置兜底、机器人输入、默写 5 秒加速和调度器生命周期 | `server/__tests__/*GameMode.test.js`, `server/__tests__/gameManager.test.js`, `server/__tests__/robotScheduler.test.js` | ✅ |
| 1n | 回归测试三种游戏完整 Socket 流程，确保事件名和主要 payload 字段兼容 | `server/tests/integration.js` | ✅ |
| 1o | 代码审查修复：last-man 离房/断线定时器清理、算术/默写 `game:rematch` 拦截、SpellingGameMode 非字符串答案类型收紧；补齐边界测试（集成 + handler 单测） | `server/src/socket/handler.js`, `server/src/socket/games/SpellingGameMode.js`, `server/__tests__/handler.test.js`, `server/tests/integration.js` | ✅ |
| 1p | 所有 Phase 1 新建/重构文件补全注释：GameMode 头注释、robotScheduler 全文 JSDoc 类型标注、测试文件 Phase 1 标注；更新 `step.md` | `server/src/socket/games/*.js`, `server/src/socket/robotScheduler.js`, `server/__tests__/*.js`, `step.md` | ✅ |
| 1q | 删除已迁移的旧兼容壳：`submitMove` / `toLegacyResult` / `handleDisconnect` / `generateQuestion` / `submitArithmeticAnswer` / `handleRobotArithmeticAnswer` / `getHumanPlayerIds` 及废弃 `@typedef`；全量 220 测试通过，gameManager.js 从 463 → 284 行 | `server/src/socket/gameManager.js`, `server/__tests__/gameManager.test.js` | ✅ |

**验收条件**

- 三种游戏现有玩法行为保持兼容
- `handler.js` 不再直接承载大量游戏规则分支
- 新增游戏模式时不需要继续扩写一个巨大的 `gameManager.js`
- 算术和默写共享 `QuizGameMode` 抢答类流程，减少重复逻辑
- 机器人定时器在开局、下一题、答对、赛果、离房、断线时都能正确清理或重建
- 默写所有人类答错后，机器人剩余等待大于 5 秒时会缩短到 5 秒
- 旧 public API 保持平铺返回格式；统一入口使用 `{ action, result }`，两者边界有测试保护
- RPS 对局历史不写入 `ranking: undefined`
- `config.games` 不存在或只配置部分游戏时仍有安全默认值
- `game:rematch` 在 Phase 1 仍仅支持 RPS；算术/默写继续通过 `game:challenge` 重赛
- 客户端现有 socket 事件名和主要 payload 字段不被破坏
- 现有服务端单元测试和集成测试通过

### Phase 2: 倒计时与机器人配置统一

目标：服务端作为每题倒计时和机器人自动回复时间的权威来源，客户端只展示服务端下发的时间，不再为算术和默写各自写死倒计时。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 2a | 在配置中定义各游戏/难度的题目时间与机器人自动回复时间，支持本地覆盖且不提交私有配置 | `server/config.js`, `server/src/socket/gameManager.js`, `server/src/socket/games/gameRegistry.js` | ✅ |
| 2b | 服务端创建 `gameInfo` / `question` 时下发 `timeLimitMs`，必要时下发 `robotAnswerAt` 或等价的剩余时间信息 | `server/src/socket/games/BaseGameMode.js`, `server/src/socket/games/ArithmeticGameMode.js`, `server/src/socket/games/SpellingGameMode.js` | ✅ |
| 2c | 算术前端改为使用服务端下发的 `timeLimitMs` 初始化倒计时和进度条，移除写死的 `ROUND_TIME` 依赖 | `client/src/components/ArithmeticBoard.jsx` | ✅ |
| 2d | 默写前端改为使用服务端下发的 `timeLimitMs` 初始化倒计时和进度条，难度只影响服务端配置选择 | `client/src/components/SpellingBoard.jsx`, `client/src/__tests__/SpellingBoard.test.jsx` | ✅ |
| 2e | 补充测试：算术/默写首题和下一题都携带时间配置，前端按下发时间展示倒计时 | `client/src/__tests__/ArithmeticBoard.test.jsx`, `client/src/__tests__/SpellingBoard.test.jsx` | ✅ |

**验收条件**

- 算术和默写的倒计时时间只需改服务端配置即可生效
- 前端显示时间和机器人实际自动回复时间一致
- 不同默写难度仍可拥有不同时间配置
- 没有配置时使用安全默认值，游戏仍可正常开始

### Phase 3: 管理后台与图片接口安全加固

当前管理接口面向家庭局域网使用，尚未设置身份认证。公网部署或开放给不可信设备前必须完成以下加固。

**设计决策**

- 认证方案：JWT（payload `{ role: 'admin', iat, exp }`），存于 httpOnly cookie（`admin_token`），sameSite=lax，24 小时过期
- Cookie secure: false（LAN 环境，不要求 HTTPS）
- JWT secret：`config.auth.jwtSecret` 配置，空则启动时 `crypto.randomBytes(32).toString('hex')` 自动生成（重启后所有已签发 token 失效；设固定值可持久化）
- 依赖：新增 `jsonwebtoken`；限速和 `candidateId` 用 `crypto.randomUUID()`（Node 16+ 内置）
- 开发模式：`config.auth.adminPassword` 为空 → 登录页正常显示，任意密码都签发合法 JWT，后续完整走校验流程
- 正式模式：`config.auth.adminPassword` 已配置 → 必须输入正确密码
- 移除 `app.use(cors())`（HTTP 同域，无需 CORS）；保留 Socket.IO CORS（dev 跨端口直连）
- `POST /api/admin/*`（login 除外）校验 Origin：`NODE_ENV === 'production'` 时，若请求头携带 Origin，则提取其 host 部分与请求 Host 头比对，不一致返回 403；`NODE_ENV` 非 production 时跳过 Origin 校验（兼容 Vite proxy 开发模式）
- 登录限速：5 次/分钟/IP；`app.proxy = true` 支持 nginx 反代获取真实 IP（`X-Forwarded-For`）；`setInterval` 每 5 分钟清理过期记录，防内存泄漏
- 候选图片走 `candidateId` 机制：`/candidates` 返回 `crypto.randomUUID()` 生成的一次性 ID，服务端缓存 `Map<word, Map<candidateId, { url, createdAt }>>`（TTL 10 分钟），`/confirm` 收 `candidateId` 查表下载；确认成功后立即从 Map 删除，禁止重复使用
- `page`/`perPage` 静默钳位（page ≥ 1，1 ≤ perPage ≤ 30）
- 错误格式统一：`ctx.status = N; ctx.body = { error: '描述' }`，拒绝 `ctx.throw()`
- 登出仅清除 Cookie，已签发 JWT 在过期前仍有效（无服务端会话的设计局限）

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 3a | 后端认证：config 增加 `auth` 段；新建 auth 中间件拦截 `/api/admin/*`（白名单 `/api/admin/login`、`/api/admin/logout`）；admin.js 新增 login/logout handler + Origin 校验 + `app.proxy = true`；index.js 挂载中间件 + 移除 `cors()` + 接入登录限速 + 定期清理 | `server/config.js`, `server/package.json`, `server/src/middleware/auth.js`（新建）, `server/src/routes/admin.js`, `server/src/index.js` | ✅ |
| 3b | 前端登录弹窗：RequireAuth 组件包裹 Admin/WordConfig 路由，挂载时请求 status 接口检测认证状态；登录弹窗提交密码获取 cookie；遇 401 触发重新登录 | `client/src/components/RequireAuth.jsx`（新建）, `client/src/App.jsx`, `client/src/pages/Admin.jsx`, `client/src/pages/WordConfig.jsx` | ✅ |
| 3c | **跳过** | — | ✅ |
| 3d | 参数校验补齐 + 错误格式统一：`page`/`perPage` 钳位；所有 admin 端点统一返回 `{ error }` | `server/src/routes/admin.js` | ✅ |
| 3e | candidateId 机制：searchCandidates 存入 `Map<word, Map<candidateId, { url, createdAt }>>`（TTL 10 分钟），返回值替换 url 为 `crypto.randomUUID()`；confirm 收 candidateId 查表下载，成功即删除；word 须在词库 + 文件名正则白名单 | `server/src/unsplashClient.js`, `server/src/routes/admin.js`, `client/src/pages/WordConfig.jsx` | ✅ |
| 3f | Phase 3 测试 | `server/__tests__/adminAuth.test.js`, `client/src/__tests__/RequireAuth.test.jsx` | ✅ |

**验收条件**

- 未登录时所有 `/api/admin/*` 返回 401（login、logout 端点除外）
- 正确密码登录后 24 小时内免登录（cookie 自动附带）
- `config.auth.adminPassword` 为空时任意密码登录成功
- 登录错误 5 次/分钟/IP 后返回 429
- 登出后 Cookie 清空，需重新登录
- 携带异常 Origin 的 POST 请求被 403 拒绝
- 候选图片不透传 URL，`/candidates` 返回 `candidateId`，`/confirm` 只收 `candidateId`
- 非词库单词、无效 candidateId、过期 candidateId、跨 word 冒用、重复使用被明确拒绝
- 篡改或过期的 JWT 被拒绝
- 生产环境未配置密码时所有管理操作被拒绝
- `page`/`perPage` 异常值被安全钳位，不会造成异常页码或过大的单次请求
- 管理端密钥不出现在前端构建产物、日志或 Git 仓库中
- 重启服务端后（auto jwtSecret 场景）旧 token 失效需重新登录

### Phase 4: 客户端重连恢复

目标：处理 Socket.IO 短暂断线重连场景。页面刷新后的身份持久化暂不纳入本阶段，避免扩大范围。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 4a | 客户端保存当前昵称和房间 ID，在 `socket.on('connect', ...)` 后自动重发 `room:join` | `client/src/App.jsx` | ✅ |
| 4b | 避免首次进入和重连恢复重复触发 toast、BGM 重启或重复事件监听 | `client/src/App.jsx`, `client/src/pages/Room.jsx` | ✅ |
| 4c | 服务端确认重复加入同一房间的行为安全：不会残留旧角色、不会重复机器人、不会污染在线玩家列表 | `server/src/socket/roomManager.js` | ✅ |
| 4d | ~~重连后自动恢复原有角色~~ | `server/src/socket/roomManager.js`, `client/src/pages/Room.jsx` | ➡️ 延期至下一版本 |
| 4e | ~~重连后恢复游戏状态（服务端补发当前题目/分数/倒计时）~~ | `server/src/socket/handler.js`, `client/src/pages/Room.jsx`, `client/src/components/*Board.jsx` | ➡️ 延期至下一版本 |
| 4f | ~~补充客户端重连测试和必要的服务端房间状态测试~~ | `client/src/__tests__/App.test.jsx`, `server/__tests__/roomManager.test.js` | ➡️ 延期至下一版本 |

**验收条件**

- 网络短暂断开并恢复后，客户端能自动重新获得房间状态
- 重连不会自动恢复已刷新页面丢失的身份，除非后续单独设计本地持久化
- 重连过程不会造成重复玩家、重复提示、重复 BGM 或重复 socket 监听
- 断线发生在游戏中时，当前版本行为有明确测试覆盖或边界说明

### Phase 5: 预发布管理员真实浏览器验收与体验收尾

使用 Codex 内置真实浏览器在预发布环境 `http://localhost:8080/family-war/admin/` 验收管理员登录、会话、后台状态、词库配置、图片同步/预览/换图、电脑端布局和控制台状态。本阶段只测试管理员页面及其词库管理子页面，不进入首页、房间或任何游戏页面。当前仅面向普通电脑大分辨率使用，不验收手机、平板或窄屏适配。

详细执行方案见 [`V3.1-Phase 5-预发布管理员真实浏览器验收与体验收尾.md`](./V3.1-Phase%205-预发布管理员真实浏览器验收与体验收尾.md)。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 5a | 验收前检查：确认预发布进程、健康检查、全量自动化测试、生产构建和工作区状态 | `server/ecosystem.config.js`, `server/__tests__/`, `client/src/__tests__/` | ✅ |
| 5b | 认证与会话：未登录拦截、错误/正确密码、Enter 登录、刷新保持、登出、401 后重新登录 | `client/src/components/RequireAuth.jsx`, `server/src/middleware/auth.js`, `server/src/routes/admin.js` | ✅ |
| 5c | 管理后台：状态统计、房间卡片、历史对局、手动刷新和 5 秒自动刷新 | `client/src/pages/Admin.jsx` | ✅ |
| 5d | 词库管理：路由往返、章节/单词开关、未保存提示、最少一个单词保护、保存与刷新持久化 | `client/src/pages/WordConfig.jsx`, `server/src/data/wordBank.js` | ✅ |
| 5e | 图片与语音：同步状态、缺失图片同步、图片预览、候选翻页、取消/确认换图、单词朗读 | `client/src/pages/WordConfig.jsx`, `server/src/unsplashClient.js` | ✅ |
| 5f | 1366×768、1440×900、1920×1080 电脑端布局、键盘操作、网络请求与控制台检查，记录并回归缺陷 | `client/src/pages/Admin.jsx`, `client/src/pages/WordConfig.jsx` | ✅ |

**验收条件**

- 详细文档中的全部管理员场景均已执行并留下结果记录
- 未认证用户无法看到管理数据，登录、刷新保持、登出和重新登录流程正常
- 词库配置能通过真实界面修改、保存、刷新验证并恢复验收前数据
- 图片同步、预览和候选换图流程正常；任何有副作用的测试均记录测试单词和最终状态
- 1366×768、1440×900、1920×1080 常见电脑分辨率下无阻断操作的遮挡、溢出或不可点击控件
- 管理员相关页面无未处理的控制台 error、资源 404 或失败的管理 API 请求
- 所有 P1、P2 缺陷关闭；延期的 P3 有明确原因和后续版本
- 全量自动化测试与生产构建通过，预发布服务保持正常

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

---

## v3.2 升级计划

### 概览

v3.2 将现有管理页面从游戏 `client` 中迁出，新建独立的 `admin-client` 前端项目。迁移后，游戏前端只负责房间和游戏，管理前端作为未来平台管理入口的雏形，当前只包含 `family-war` 管理模块。

本版本主要调整前端源码、测试和构建编排，并增加一段独立管理站点所需的 Nginx 静态文件配置。明确保持以下内容不变：

- 不修改 `server/` 业务代码和内部路由；
- 不修改 `/api/admin/*` 管理接口协议；
- 不修改现有管理员密码、JWT、`admin_token` Cookie 和认证流程；
- 不迁移公网 API 与 Socket.IO 路径；
- 不实现微信登录、平台普通用户、家庭档案或 RBAC；
- 不处理 v3.1 延期的游戏断线角色和对局恢复事项。

目标目录：

```text
family-war/
├── client/          # 只包含游戏前端
├── admin-client/    # 独立管理前端
├── server/          # 本版本不改
└── package.json     # 统一编排三个 package
```

生产环境目标路径：

```text
游戏：       /family-war/
管理首页：   /admin/
词库管理：   /admin/family-war/word-config
管理 API：   /family-war/api/admin/*
图片 API：   /family-war/api/images/*
Socket.IO：  /family-war/socket.io
```

管理端使用独立的 `admin-client/build/` 构建目录，由新增的 `/admin/` Nginx location 提供静态文件和 SPA 回退。管理页面与游戏页面从 v3.2 起即拥有独立 URL 和部署目录。

### Phase 1：建立 `admin-client` 工程骨架

目标：创建可独立启动、测试和构建的 Vite + React 管理前端，并先确定不会影响游戏构建产物的输出规则。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 1a | 新建 `admin-client` package，版本设为 `3.2.0`，配置 React 19、Ant Design v5、React Router v6、Vitest 和 Testing Library；不安装 `socket.io-client`，Playwright 在 Phase 5 随验收套件迁入 | `admin-client/package.json`, `admin-client/package-lock.json` | ✅ |
| 1b | 新建 Vite 配置：生产 `base` 为 `/admin/`，开发端口为 `3001`，`/api` 代理到 `http://localhost:4000` | `admin-client/vite.config.js` | ✅ |
| 1c | 配置管理端独立构建输出到自身 `build/`，不得写入或复制到 `client/build/` | `admin-client/vite.config.js` | ✅ |
| 1d | 建立 HTML 入口、React 入口、最小全局样式和 Vitest 环境；管理端样式独立维护，不从 `client/src` 跨目录导入 | `admin-client/index.html`, `admin-client/src/index.jsx`, `admin-client/src/index.css`, `admin-client/src/setup-vitest.js` | ✅ |
| 1e | 建立应用入口和 Browser Router，`basename="/admin"`；`/` 为管理首页，`/family-war` 为状态页，`/family-war/word-config` 为词库管理页，未知路由回到管理首页 | `admin-client/src/App.jsx` | ✅ |
| 1f | 验证空壳管理端可在 `:3001` 启动、测试和构建，构建文件引用路径均以 `/admin/` 开头 | `admin-client/` | ✅ |

**设计约束**

- `admin-client` 是独立 package，不允许从 `client/src` 直接导入组件、工具或样式；
- 管理端不依赖游戏 Socket.IO 单例；
- `client` 和 `admin-client` 分别只写入自己的 `build/`；
- 两个前端可以独立构建，完整生产构建不依赖特定先后顺序；
- 开发环境通过管理端 Vite 代理访问原有 `/api/*`，不要求后端开放新的 CORS 范围。

### Phase 2：迁移管理页面和认证

目标：将现有管理能力等价迁移到 `admin-client`，保持接口、Cookie 和用户操作不变。

建议模块结构：

```text
admin-client/src/
├── app/
├── auth/
│   ├── AdminAuthContext.jsx
│   └── RequireAdminAuth.jsx
├── layout/
├── modules/
│   └── family-war/
│       ├── api.js
│       ├── AdminPage.jsx
│       └── WordConfigPage.jsx
└── config/
    └── services.js
```

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 2a | 建立 `family-war` 服务配置；开发环境 API Base 为空字符串，生产环境暂时为 `/family-war`，页面不再直接从 Vite Public Base 推导 API 地址 | `admin-client/src/config/services.js` | ✅ |
| 2b | 将现有 `RequireAuth` 迁为管理端认证组件，保留 status 探测、密码登录、401 重新登录、登出状态和 `admin_token` Cookie 行为 | `admin-client/src/auth/AdminAuthContext.jsx`, `admin-client/src/auth/RequireAdminAuth.jsx` | ✅ |
| 2c | 将 `Admin.jsx` 迁入 `modules/family-war`，保留房间、玩家、历史对局、手动刷新和 5 秒自动刷新 | `admin-client/src/modules/family-war/AdminPage.jsx` | ✅ |
| 2d | 将 `WordConfig.jsx` 迁入 `modules/family-war`，保留章节/单词配置、图片状态、缺失同步、候选翻页、确认换图、缓存刷新和 TTS | `admin-client/src/modules/family-war/WordConfigPage.jsx` | ✅ |
| 2e | 抽出 family-war 管理 API 封装，集中维护 `/api/admin/*` 和 `/api/images/*` 地址；保持服务端请求方法、请求体和响应结构不变 | `admin-client/src/modules/family-war/api.js` | ✅ |
| 2f | 调整页面导航以适配 `/admin` Browser Router，确保管理首页、family-war 状态页与词库管理之间往返正常 | `admin-client/src/App.jsx`, `admin-client/src/modules/family-war/*.jsx` | ✅ |
| 2g | 增加最小管理布局，为后续多应用入口预留导航区域；本版本只展示 `family-war`，不提前实现空的跨应用框架功能 | `admin-client/src/layout/AdminLayout.jsx` | ✅ |

**兼容要求**

- 管理端所有请求继续命中现有 Koa `/api/admin/*` 和 `/api/images/*`；
- `fetch` 继续使用同源 Cookie，不在前端读取或保存 JWT；
- 当前 `GET /api/admin/status` 同时承担认证探测和状态查询的行为暂不调整；
- 管理员认证继续使用现有 `jwtSecret`，不增加平台用户密钥或微信认证配置；
- 管理端页面迁移不改变词库文件、图片缓存及服务端内存状态。

### Phase 3：精简游戏 `client`

目标：从游戏前端彻底移除管理页面和认证依赖，使游戏入口成为纯游戏应用。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 3a | 从游戏 `App.jsx` 删除 Admin、WordConfig、RequireAuth 和路由导入，移除 `/admin`、`/admin/word-config` 路由 | `client/src/App.jsx` | ✅ |
| 3b | 删除游戏入口的 Browser Router 包装；保留 Ant Design App 容器并直接渲染游戏应用 | `client/src/App.jsx` | ✅ |
| 3c | 删除已经迁移的管理页面、认证组件、管理 API 工具及其旧测试文件 | `client/src/pages/Admin.jsx`, `client/src/pages/WordConfig.jsx`, `client/src/components/RequireAuth.jsx`, `client/src/utils/api.js`, `client/src/__tests__/Admin.test.jsx`, `client/src/__tests__/WordConfig.test.jsx`, `client/src/__tests__/RequireAuth.test.jsx` | ✅ |
| 3d | 检查并清理游戏端不再使用的 `react-router-dom` 等依赖；Ant Design 若仍被游戏 UI 使用则保留 | `client/package.json`, `client/package-lock.json` | ✅ |
| 3e | 补充游戏 App 回归测试，确认渲染游戏首页时仍使用 Socket.IO，而源码和构建产物中不再包含管理页面入口 | `client/src/__tests__/App.test.jsx` | ✅ |
| 3f | 全局搜索确认 `client/src` 不再出现 Admin、WordConfig、RequireAuth 和 `/admin` 路由引用 | `client/src/` | ✅ |

**边界说明**

- 本版本不改变游戏端现有模块级 Socket.IO 单例；
- 游戏端加载时仍会正常连接 Socket.IO；
- v3.2 解决的是管理页面不再加载游戏 Socket.IO，而不是重构游戏连接生命周期；
- 不能为了代码复用新建同时被两个前端直接引用的源码目录，避免重新耦合构建配置。

### Phase 4：根项目编排与生产构建

目标：让三个 package 的日常命令清晰可用，并保证游戏端和管理端各自在独立目录中生成生产构建。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 4a | 根目录新增 `admin` 命令，并将 `dev` 扩展为同时启动 server、client、admin-client，终端名称和颜色可区分 | `package.json` | ✅ |
| 4b | 根目录新增 `build`，分别构建游戏端和管理端，最终生成 `client/build/index.html` 与 `admin-client/build/index.html` | `package.json` | ✅ |
| 4c | 根目录 `test` 扩展为服务端、游戏端和管理端测试；保留独立 package 测试命令 | `package.json` | ✅ |
| 4d | 增加可重复的完整构建校验，确认任一前端重新构建都不会修改或删除另一个前端的产物 | `package.json`, `client/vite.config.js`, `admin-client/vite.config.js` | ✅ |
| 4e | 统一根、游戏端、管理端和服务端发布版本号为 `3.2.0`；仅更新版本元数据，不改变服务端行为 | `package.json`, `package-lock.json`, `client/package.json`, `client/package-lock.json`, `admin-client/package.json`, `admin-client/package-lock.json`, `server/package.json`, `server/package-lock.json` | ✅ |

**构建验收**

完整构建后至少存在：

```text
client/build/index.html
client/build/assets/
admin-client/build/index.html
admin-client/build/assets/
```

并满足：

- 游戏 `index.html` 只引用 `/family-war/` 下的游戏资源；
- 管理 `index.html` 只引用 `/admin/` 下的管理资源；
- 再次执行完整构建不会残留旧的哈希资源；
- 管理端构建产物不包含 Socket.IO 客户端代码；
- 游戏和管理端产物之间不存在复制、嵌套或交叉写入。

### Phase 5：测试迁移与自动化准备

目标：保持管理功能现有测试覆盖，将所有以管理页面为对象的 Playwright 验收代码整体归入 `admin-client`，完成本地测试与预发布验收能力准备；本阶段不连接预发布环境执行 acceptance。

目标测试边界：

```text
server/__tests__/                    服务端单元测试
server/tests/integration.js          Socket.IO 服务集成测试
client/src/__tests__/                游戏前端单元测试
admin-client/src/__tests__/          管理前端单元测试
admin-client/tests/acceptance/       管理端 Playwright 浏览器验收
```

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 5a | 将 Admin 页面测试迁入管理端，覆盖标题、空状态、统计和刷新行为 | `admin-client/src/__tests__/AdminPage.test.jsx` | ✅ |
| 5b | 将 RequireAuth 测试迁入管理端，覆盖未登录、登录成功/失败、401、登出和 Cookie 同源请求流程 | `admin-client/src/__tests__/RequireAdminAuth.test.jsx` | ✅ |
| 5c | 将 WordConfig 测试迁入管理端，保持现有词库开关、保存、同步、候选图和换图覆盖 | `admin-client/src/__tests__/WordConfigPage.test.jsx` | ✅ |
| 5d | 增加路由测试，覆盖 `/admin/`、`/admin/family-war/`、`/admin/family-war/word-config`、未知路径回退和页面间导航 | `admin-client/src/__tests__/App.test.jsx` | ✅ |
| 5e | 将 `server/tests/acceptance/` 整体迁移到 `admin-client/tests/acceptance/`，包含 runner、Page Object、steps、lib、恢复机制和报告输出目录，迁移过程中保持异常与中断后的数据恢复能力 | `server/tests/acceptance/` → `admin-client/tests/acceptance/` | ✅ |
| 5f | 将 `@playwright/test` 从服务端依赖迁到管理端；管理端增加 `test:acceptance`、`test:acceptance:restore`，根目录增加统一委托命令 | `server/package.json`, `server/package-lock.json`, `admin-client/package.json`, `admin-client/package-lock.json`, `package.json` | ✅ |
| 5g | 修改 runner 的路径解析：从仓库根目录显式定位 `server/config.local.js`、词库配置和图片目录；不得依赖验收代码仍位于 `server/` | `admin-client/tests/acceptance/runner.js`, `admin-client/tests/acceptance/lib/cleanup.js` | ✅ |
| 5h | 分离管理页面与 API 验收地址：新增 `ACCEPTANCE_ADMIN_URL`（`/admin`）并保留独立 `ACCEPTANCE_API_URL`（v3.2 仍为 `/family-war`）；删除管理验收未使用的 `socketURL` 和 `ACCEPTANCE_SOCKET_PATH` | `admin-client/tests/acceptance/test-config.js`, `admin-client/tests/acceptance/runner.js` | ✅ |
| 5i | 更新 Playwright 页面入口和选择器，通过 Browser Router 访问 `/admin/family-war/` 与 `/admin/family-war/word-config` | `admin-client/tests/acceptance/pages/`, `admin-client/tests/acceptance/steps/`, `admin-client/tests/acceptance/lib/auth.js` | ✅ |
| 5j | 增加浏览器网络断言：管理端不得请求 `/socket.io` 或 `/family-war/socket.io`，管理请求仍通过 `/family-war/api/*` | `admin-client/tests/acceptance/` | ✅ |
| 5k | 整理运行产物：临时状态、备份和普通运行截图加入 `.gitignore`；需要随版本保留的正式验收报告另存到版本化文档目录 | `.gitignore`, `admin-client/tests/acceptance/output/`, `docs/acceptance/v3.2/`（如需） | ✅ |
| 5l | 更新验收自动化方案中的目录、命令、环境变量、恢复路径和运行示例 | `docs/Phase-6-验收自动化方案.md` | ✅ |
| 5m | 执行服务端、游戏端、管理端全部单元测试和 Socket.IO 集成测试；检查管理端 Playwright 用例发现、配置加载及本地运行能力，不执行预发布 acceptance 和生产构建 | `server/`, `client/`, `admin-client/` | ✅ |

**测试边界**

- 服务端既有单元测试和 Socket.IO 集成测试原则上不需要修改断言；
- 仅因管理前端入口变化而更新验收测试 URL，不改变后端请求预期；
- 管理端单元测试不得继续依赖游戏端的 `useSocket` mock；
- 测试必须证明管理端没有加载或连接 Socket.IO，而不只是页面上没有游戏组件。
- Playwright runner 虽会准备服务端配置、重启 PM2 和恢复词库/图片数据，但这些属于管理端端到端验收的环境编排，不改变测试所有权；
- 验收套件不得拆成管理端用例与服务端恢复脚本两部分，避免跨 package 相互调用和恢复流程分散；
- 未来覆盖平台首页、多个前端和多个后端的跨系统验收出现后，再考虑建立仓库级 `tests/e2e/`。

### Phase 6：预发布验收、正式部署与文档收尾

目标：在保持现有游戏、API 和 Socket.IO 配置不变的基础上，为管理端增加独立 Nginx 静态站点；完成生产构建和预发布部署后运行 acceptance，验收通过再按原有发布流程部署正式环境。本版本暂不增加生产环境只读冒烟检查。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 6a | 执行完整生产构建，确认游戏和管理端产物分别位于 `client/build/` 与 `admin-client/build/`，PM2 服务配置不变 | `client/build/`, `admin-client/build/`, `server/ecosystem.config.js` | ✅ |
| 6b | 验证 `/family-war/` 游戏首页、房间加入和 Socket.IO 连接正常 | 预发布环境 | ✅ |
| 6c | 增加 `/admin` 到 `/admin/` 的跳转和 `/admin/` 独立静态站点配置，使用 `admin-client/build/` 并为 Browser Router 配置 SPA 回退；执行 `nginx -t` 后重载 | Nginx `family-war.conf` 或独立 `admin.conf` | ✅ |
| 6d | 验证 `/admin/` 登录、刷新保持、登出、自动刷新和 family-war 词库管理正常 | 预发布环境 | ✅ |
| 6e | 验证直接刷新 `/admin/family-war/` 和 `/admin/family-war/word-config` 正常，浏览器前进/后退正常 | 预发布环境 | ✅ |
| 6f | 检查管理端网络和控制台：无 Socket.IO 请求、无资源 404、无错误 API 路径和未处理异常 | 预发布环境 | ✅ |
| 6g | 回归 `/family-war/`、`/family-war/api/` 和 `/family-war/socket.io`，确认新增 `/admin/` location 未改变现有匹配行为 | 预发布环境 | ✅ |
| 6h | 对已部署的预发布环境执行管理端完整 `test:acceptance`，确认测试数据在成功、失败或中断后均已恢复 | `admin-client/tests/acceptance/`, 预发布环境 | ✅ |
| 6i | acceptance 验收通过后，按现有发布流程将 v3.2 部署到正式环境；本阶段不新增生产环境只读冒烟检查 | 现有正式发布流程 | ✅ |
| 6j | 更新项目结构、开发命令、构建命令、管理入口和部署说明 | `README.md`, `AGENTS.md` | ✅ |
| 6k | 更新路线图状态和 v3.2 发布说明；明确 v3.3 才开始修改公网 API 和 Socket.IO 路径 | `road-map.md`, `docs/RELEASE.md` 或版本发布说明 | ✅ |

### v3.2 最终验收条件

- 仓库包含独立且可单独运行的 `admin-client`；
- 游戏 `client` 不再包含管理页面、管理认证组件和管理路由；
- `/admin/` 使用 `admin-client/build/` 中独立的 HTML、JS 和 CSS 产物；
- 管理端打开、深层路由刷新和 Browser Router 导航正常；
- 管理员登录、JWT Cookie、登出和 401 处理与 v3.1 行为一致；
- 管理状态、词库配置、图片同步、候选图片和 TTS 功能与迁移前一致；
- 管理端不安装、不打包、不请求 Socket.IO；
- 管理端 Playwright 验收套件、依赖和运行命令归属 `admin-client`，服务端不再承担浏览器测试依赖；
- 游戏端现有 Socket.IO 行为和三种游戏玩法不变；
- 后端代码、内部路由、API 协议和 PM2 配置不变；Nginx 只增加独立 `/admin/` 静态站点；
- 根目录可以统一启动、测试和构建三个 package；
- 完整构建可以重复执行，且两个前端构建产物彼此独立；
- 服务端、游戏端、管理端单元测试全部通过；
- Socket.IO 集成测试和生产构建通过，预发布环境 acceptance 验收通过后才部署正式环境；
- README、`road-map.md` 和验收文档与实际行为一致。

### 明确延期到后续版本

- `/api/family-war/` 公网 API 路径迁移；
- `/socket/family-war/` Socket.IO 路径迁移；
- 管理认证接口从应用业务接口中解耦；
- 多管理员账号、权限和审计；
- 微信认证、平台普通用户、家庭关系和儿童档案；
- 游戏 Socket.IO 连接生命周期重构；
- 页面刷新后的游戏身份、角色和对局恢复。

---

# v3.3：公网资源路径规范化实施计划

> 规划版本：v3.3.0
>
> 前置版本：v3.2.0
>
> 目标：将 family-war 的公网 API 与 Socket.IO 路径从页面目录中解耦，形成可供整个体系继续扩展的统一资源路径；后端内部路由和协议保持不变。
>
> 核心策略：先增加新入口并保留旧入口，再切换前端，确认兼容入口无实际流量后由后续版本决定是否移除。

## 1. 路径契约

### 1.1 v3.3 完成后的公网路径

| 类型 | v3.2 路径 | v3.3 标准路径 | v3.3 处理方式 |
|------|-----------|---------------|----------------|
| 游戏页面 | `/family-war/` | `/family-war/` | 保持不变 |
| 管理页面 | `/admin/` | `/admin/` | 保持不变 |
| HTTP API | `/family-war/api/*` | `/api/family-war/*` | 前端切换到新路径，旧路径继续兼容 |
| Socket.IO | `/family-war/socket.io/*` | `/socket/family-war/*` | 游戏端切换到新路径，旧路径继续兼容 |

### 1.2 Nginx 与服务端内部路径映射

| 公网入口 | Nginx 转发目标 | 服务端是否修改 |
|----------|----------------|----------------|
| `/api/family-war/*` | `/api/*` | 否，Koa 继续使用现有 `/api/*` 路由 |
| `/socket/family-war/*` | `/socket.io/*` | 否，Socket.IO 继续使用现有 `/socket.io/` path |
| `/family-war/api/*` | `/api/*` | 否，作为 v3.3 兼容入口保留 |
| `/family-war/socket.io/*` | `/socket.io/*` | 否，作为 v3.3 兼容入口保留 |

路径约束：

- 页面、API 和 Socket.IO 分属 `/family-war/`、`/api/family-war/`、`/socket/family-war/` 三个命名空间；
- 新旧 API 路径由 Nginx 直接反向代理，不使用浏览器重定向；
- Socket.IO 新旧路径均直接代理，禁止通过 301/302 改写；
- `/socket/family-war/` 必须同时支持 HTTP long-polling 和 WebSocket Upgrade；
- 服务端返回的 `/api/images/*` 属于内部 API 语义，游戏端必须转换为公网 API 基址，不能再拼接页面基址；
- 所有公网基址均集中配置，业务组件和验收测试不得自行硬编码生产路径。

## 2. 本版本范围

v3.3 包含：

- 为游戏端拆分页面基址、API 基址和 Socket.IO path；
- 将管理端生产 API 基址切换为 `/api/family-war`；
- 规范服务端相对图片 URL 在浏览器端的解析；
- 增加新 Nginx API 与 Socket.IO location，同时保留 v3.2 兼容入口；
- 增加新旧 API 路径、Socket.IO polling/WebSocket 和图片资源的自动化验收；
- 更新生产构建、预发布、正式发布、回滚和兼容观察流程。

v3.3 不包含：

- 修改 Koa 的 `/api/*` 路由或 Socket.IO 的内部 `/socket.io/` path；
- 修改请求、响应、事件名称、JWT、Cookie 或管理员认证流程；
- 移除 v3.2 的旧 API、Socket.IO 公网入口；
- 建设统一身份平台、微信认证、权限模型或审计系统；
- 建设平台首页或迁移游戏页面路径。

## 3. 发布与回滚原则

发布必须遵循以下顺序：

1. 完成代码、配置和自动化测试准备，但不先让生产前端引用新入口；
2. 在预发布环境增加新 Nginx location，同时保留并验证旧入口；
3. 部署 v3.3 前端产物，使游戏端和管理端切换到新入口；
4. 完成新入口完整验收和旧入口兼容回归；
5. 按同样顺序发布正式环境。

回滚原则：

- v3.3 不删除旧入口，因此前端回滚到 v3.2 构建产物时无需同步回滚后端；
- 若新前端异常，优先恢复 v3.2 的 `client/build/` 和 `admin-client/build/`；
- 若新增 Nginx location 异常，可在恢复 v3.2 前端后移除新 location，但不得先移除旧入口；
- 本版本无数据迁移，也不改变 JWT Cookie，回滚不需要转换数据或强制管理员重新登录。

## Phase 1：冻结路径契约与建立配置边界

目标：先把页面路径、API 基址和 Socket.IO path 变成独立配置，防止后续业务代码继续依赖字符串拼接。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 1a | 盘点游戏端、管理端、Nginx、测试和文档中的 `/family-war/api`、`/family-war/socket.io`、`/api`、`/socket.io` 硬编码，形成迁移清单 | `client/`, `admin-client/`, `server/`, Nginx 配置、文档 | ✅ |
| 1b | 在游戏端集中定义页面基址、API 基址和 Socket.IO path；开发环境分别保持 `/family-war/` 或 Vite base、`/api`、`/socket.io`，生产环境使用 `/family-war/`、`/api/family-war`、`/socket/family-war/` | `client/src/config/`、`client/vite.config.js` | ✅ |
| 1c | 统一管理端 API 基址语义：基址本身包含 `/api`，接口方法只追加 `/admin/*` 等业务路径；生产值改为 `/api/family-war` | `admin-client/src/config/services.js`, `admin-client/src/api/` | ✅ |
| 1d | 为路径连接增加统一规则，处理首尾斜杠，避免生成双斜杠、漏斜杠或把相对 URL 错当成页面资源 | `client/src/config/`, `admin-client/src/config/` | ✅ |
| 1e | 为开发和生产配置增加单元测试，证明三个基址相互独立且最终 URL 符合路径契约 | `client/src/**/*.test.*`, `admin-client/src/**/*.test.*` | ✅ |

## Phase 2：切换前端 API、图片与 Socket.IO 路径

目标：让两个前端只通过标准公网入口访问服务，同时保持现有功能和认证行为不变。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 2a | 将管理状态、登录、登出、词库、图片同步、候选图片和 TTS 请求统一切换到新的 API 基址 | `admin-client/src/api/`, `admin-client/src/auth/` | ✅ |
| 2b | 保持管理端请求的 credentials、401 处理和刷新登录状态逻辑不变，验证 `/admin/` 页面通过 `/api/family-war/admin/*` 使用原有 JWT Cookie | `admin-client/src/` | ✅ |
| 2c | 将游戏端生产 Socket.IO path 切换为 `/socket/family-war/`；服务地址仍使用当前 origin，不改变事件协议或连接生命周期 | `client/src/hooks/useSocket.js`, `client/src/config/` | ✅ |
| 2d | 修改默写图片 URL 解析：服务端返回 `/api/images/*` 时转换为 `${API_BASE}/images/*`，不得再转换为 `/family-war/api/images/*` | `client/src/components/SpellingBoard.jsx`, `client/src/config/` | ✅ |
| 2e | 补充绝对 URL、内部 `/api/*` URL、已是标准公网 URL、空值和非法值的图片解析测试，避免二次加前缀 | `client/src/components/*.test.*` | ✅ |
| 2f | 更新管理端和游戏端现有请求 mock、快照及断言；开发环境的实际代理入口仍为 `/api/*` 和 `/socket.io/*` | `client/src/**/*.test.*`, `admin-client/src/**/*.test.*` | ✅ |
| 2g | 执行两个前端单元测试和生产构建，检查构建产物引用新 API/Socket.IO 路径且不再引用旧生产路径 | `client/`, `admin-client/` | ✅ |

## Phase 3：扩充网关与浏览器自动化验收

目标：在变更网关前准备可重复执行的证据，覆盖 HTTP、polling、WebSocket、图片和管理认证。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 3a | 将 acceptance 的 API 基址改为可配置项，预发布默认使用 `/api/family-war`，测试代码不得硬编码 `/family-war/api` | `admin-client/tests/acceptance/` | ✅ |
| 3b | 更新管理登录、状态检查、词库、图片和 TTS 用例，使全部管理 API 断言匹配 `/api/family-war/*` | `admin-client/tests/acceptance/` | ✅ |
| 3c | 更新浏览器网络断言：管理页面不得连接任何 Socket.IO；管理请求必须使用 `/api/family-war/*`，不得回退到 `/family-war/api/*` | `admin-client/tests/acceptance/` | ✅ |
| 3d | 增加通过 Nginx 新 path 建立 Socket.IO polling 连接的网关测试，验证连接、加入房间和至少一个既有事件往返 | `server/tests/` 或独立网关验收脚本 | ✅ |
| 3e | 增加通过 Nginx 新 path 建立纯 WebSocket 连接的网关测试，验证 Upgrade 成功和事件往返 | `server/tests/` 或独立网关验收脚本 | ✅ |
| 3f | 增加旧 `/family-war/socket.io/` 的 polling/WebSocket 兼容检查，证明 v3.2 客户端仍可连接 | 网关验收脚本 | ✅ |
| 3g | 增加新旧 API 入口的兼容检查：相同只读请求返回一致的状态码、关键响应头和业务结果 | 网关验收脚本 | ✅ |
| 3h | 增加图片链路验收：接口返回的相对地址经游戏端解析后请求 `/api/family-war/images/*` 并获得有效图片响应 | `client/` 测试、浏览器或网关验收脚本 | ✅ |

## Phase 4：增加 Nginx 标准入口并保留双路径

目标：先让新入口可用，再允许前端切换；任何阶段都不打断 v3.2 客户端。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 4a | 增加 `/api/family-war/` location，将前缀剥离后转发到服务端 `/api/`，传递 Host、真实 IP 和转发协议等必要请求头 | Nginx `family-war.conf` 或相关站点配置 | ✅ |
| 4b | 增加 `/socket/family-war/` location，转发到服务端 `/socket.io/`，配置 HTTP/1.1、Upgrade、Connection、超时和必要请求头 | Nginx `family-war.conf` 或相关站点配置 | ✅ |
| 4c | 保留 `/family-war/api/` 与 `/family-war/socket.io/` 的原有代理规则，不增加重定向，不改变其匹配优先级和行为 | Nginx `family-war.conf` 或相关站点配置 | ✅ |
| 4d | 为旧入口保留可识别的访问记录或统计方式，用于后续版本判断是否可以安全移除；日志不得记录 JWT、Cookie 或敏感请求体 | Nginx 日志配置、运维说明 | ✅ |
| 4e | 在预发布环境执行 `nginx -t`，确认 location 匹配、`proxy_pass` 尾斜杠和配置语法正确后再重载 | 预发布环境 | ✅ |
| 4f | 在尚未部署 v3.3 前端时验证新入口可用、v3.2 页面与旧入口仍正常，形成 Nginx 变更前后对照记录 | 预发布环境、验收报告 | ✅* |

\* 当前 Nginx 静态目录直接指向仓库 `build/`，Phase 2 的生产构建已同步更新预发布静态产物，无法再单独验证旧 v3.2 页面构建；本步骤改以游戏/管理页面 200、新旧 API 一致，以及旧 Socket.IO polling/WebSocket 真实连接证明兼容性。详见 `docs/acceptance/v3.3/phase-4-nginx-report.md`。

## Phase 5：预发布部署与完整验收

目标：在预发布环境切换两个前端，验证标准入口、旧入口兼容和全部既有业务。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 5a | 执行根项目完整生产构建，确认游戏端和管理端产物独立生成，服务端产物、PM2 配置和内部路由未变化 | 根 `package.json`, `client/build/`, `admin-client/build/`, `server/` | ✅ |
| 5b | 部署 v3.3 游戏端和管理端产物到预发布环境，不修改服务端版本或运行参数 | 预发布环境 | ✅ |
| 5c | 验证 `/family-war/` 加载、刷新、加入房间和三种游戏模式正常，网络请求使用 `/socket/family-war/` | 预发布环境 | ✅ |
| 5d | 分别执行 Socket.IO polling-only 和 WebSocket-only 验收，确认握手、升级、断线重连及事件通信正常 | 预发布环境、网关验收脚本 | ✅ |
| 5e | 验证默写模式实际图片请求使用 `/api/family-war/images/*`，无 `/family-war/api/images/*`、404、混合内容或跨域错误 | 预发布环境 | ✅ |
| 5f | 验证 `/admin/` 登录、刷新保持、登出、401、词库、图片同步、候选图片和 TTS，网络请求全部使用 `/api/family-war/*` | 预发布环境 | ✅ |
| 5g | 执行管理端完整 Playwright acceptance，确认测试数据在成功、失败或中断后均恢复 | `admin-client/tests/acceptance/`, 预发布环境 | ✅ |
| 5h | 运行新旧 API 和 Socket.IO 兼容测试，确认 v3.2 客户端所依赖的旧入口仍可使用 | 预发布环境、网关验收脚本 | ✅ |
| 5i | 检查浏览器控制台、Nginx 错误日志和服务端日志，确认无错误路径、代理循环、异常 30x、握手失败或新增 4xx/5xx | 预发布环境、验收报告 | ✅ |
| 5j | 演练前端回滚：恢复 v3.2 构建后不改后端即可通过旧 API 和 Socket.IO 入口运行，再恢复 v3.3 构建 | 预发布环境、回滚记录 | ✅ |

## Phase 6：正式发布、版本收尾与兼容观察

目标：复用预发布已验证的顺序发布正式环境，并为将来移除旧入口留下可靠依据。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 6a | 更新根项目、游戏端、管理端和服务端的版本元数据为 `3.3.0`，同步 lockfile；服务端仅保持版本一致，不修改运行逻辑 | `package.json`, `package-lock.json`, `client/`, `admin-client/`, `server/` | ✅ |
| 6b | 更新路径架构、环境配置、开发代理、Nginx 示例、部署顺序和回滚说明 | `README.md`, `AGENTS.md`, `docs/ROUTING-MIGRATION-PLAN.md`, 部署文档 | ✅ |
| 6c | 更新路线图，将 v3.3 标记为已完成，并记录旧入口仍处于兼容期、移除条件尚未满足 | `road-map.md` | ✅ |
| 6d | 在正式环境先增加并验证新 Nginx API 与 Socket.IO location，确认旧入口保持可用 | 正式环境 | ✅ |
| 6e | 新入口验证通过后部署 v3.3 前端产物，按预发布清单完成游戏、管理、图片、polling 和 WebSocket 验收 | 正式环境、发布记录 | ✅ |
| 6f | 发布 v3.3.0 Git tag 和 GitHub Release，发布说明列出新标准路径、兼容路径、回滚方式和无后端协议变更 | `docs/RELEASE.md`、GitHub Release | ✅ |
| 6g | 在约定观察周期内统计旧 API 与 Socket.IO 入口的非敏感访问量，区分真实客户端、监控和扫描流量 | Nginx 访问统计、运维记录 | 🔄 |
| 6h | 根据观察结果为后续版本单独提出旧入口下线计划；v3.3 内不得直接删除兼容入口 | `road-map.md`、后续版本计划 | ✅ |

## v3.3 最终验收条件

- `/family-war/` 和 `/admin/` 页面路径保持不变；
- 管理端所有生产 API 请求使用 `/api/family-war/*`；
- 游戏端生产 Socket.IO 请求使用 `/socket/family-war/`；
- 游戏端页面基址、API 基址和 Socket.IO path 独立配置；
- 默写图片通过 `/api/family-war/images/*` 正常加载，不再依赖 `/family-war/api/images/*`；
- `/socket/family-war/` 的 polling 和 WebSocket 均通过真实 Nginx 网关验收；
- 管理端不建立 Socket.IO 连接，管理员登录和 JWT Cookie 行为与 v3.2 一致；
- Koa `/api/*` 路由、Socket.IO `/socket.io/` 内部 path、事件协议和 PM2 配置没有行为变更；
- `/family-war/api/*` 和 `/family-war/socket.io/*` 在 v3.3 中继续可用；
- 新旧入口间不存在浏览器 301/302 迁移，Socket.IO 不依赖重定向；
- 服务端、游戏端和管理端单元测试、集成测试、生产构建及预发布 acceptance 全部通过；
- 已完成前端回滚演练，恢复 v3.2 构建时不需要回滚服务端；
- 文档、发布说明和实际 Nginx/前端配置一致。

## 明确延期到后续版本

- 在 v3.5 删除 `/family-war/api/*` 与 `/family-war/socket.io/*` 兼容入口，执行前必须通过 v3.3—v3.4 访问日志观察门槛；
- 修改服务端内部 `/api/*` 或 `/socket.io/` 路径；
- 将 family-war 管理认证迁移到统一身份服务；
- 多管理员、角色权限、审计和细粒度授权；
- 微信认证、平台普通用户、家庭关系和儿童档案；
- 平台首页和其他业务系统的公网路径迁移。

---

# v3.4：平台管理框架完善实施计划

> 规划版本：v3.4.0
>
> 前置版本：v3.3.0
>
> 目标：在现有独立 `admin-client` 基础上，把已经存在的平台首页、管理布局和 family-war 模块整理为可扩展的管理框架，为后续接入其他应用管理模块建立稳定约定。
>
> 核心边界：本版本只调整管理前端及其自动化，不修改 family-war 后端业务协议，不实施管理员认证解耦，不删除 v3.3 兼容入口。

## 1. 当前基础与目标结构

v3.3 已具备：

- `/admin/` 独立站点和 Browser Router；
- `AdminLayout` 顶层布局；
- `/admin/` 应用入口页；
- `modules/family-war` 业务模块；
- 管理员登录保护和 family-war API 封装；
- 管理端 Playwright acceptance。

v3.4 目标结构：

```text
admin-client/src/
├── app/
│   ├── AdminApp.jsx             # Router、Provider 和顶层错误边界
│   ├── appRegistry.js           # 应用元数据与入口注册
│   └── routes.jsx               # 平台和模块路由集中装配
├── auth/                        # 保持现有管理员认证协议
├── components/
│   ├── AppEntryCard.jsx         # 应用入口卡片
│   ├── PageHeader.jsx           # 页面标题、面包屑和操作区
│   └── RequestState.jsx         # 加载、空状态和错误展示
├── layout/
│   └── AdminLayout.jsx          # 平台导航和内容容器
├── modules/
│   └── family-war/
│       ├── index.js             # 模块公开入口与路由元数据
│       ├── api.js
│       ├── AdminPage.jsx
│       └── WordConfigPage.jsx
└── pages/
    ├── AdminHomePage.jsx
    └── NotFoundPage.jsx
```

目录名称可在实施时按实际代码简化，但必须保留“平台外壳不直接导入模块页面细节、模块通过公开入口注册”的边界。

## 2. 本版本范围

v3.4 包含：

- 建立应用注册表，统一应用名称、说明、图标、入口路径和导航信息；
- 从 `App.jsx` 拆出平台首页和集中路由装配；
- 让首页卡片、顶部导航和面包屑从同一份应用元数据生成；
- 为 family-war 模块建立公开入口，减少平台层跨目录引用内部页面；
- 统一平台级加载、空状态、请求失败、404 和不可恢复错误展示；
- 规范模块 API 配置、错误转换和 401 处理边界；
- 扩充管理端单元测试与 Playwright acceptance；
- 保持 `/admin/`、`/admin/family-war/` 和词库页面 URL 不变。

v3.4 不包含：

- 新增其他应用的真实管理页面或伪造占位业务；
- 修改 Koa 路由、响应结构、JWT Secret、Cookie 名称或管理员登录协议；
- 引入多管理员、RBAC、审计或统一认证后端；
- 微信认证、普通用户、家庭关系或儿童档案；
- 删除 `/family-war/api/*` 或 `/family-war/socket.io/*` 兼容入口；
- 修改游戏前端、Socket.IO 事件或游戏状态恢复。

## 3. 设计约束

- `appRegistry` 只保存可序列化元数据和模块公开入口，不保存鉴权令牌或运行状态；
- 平台首页和导航不得分别维护应用列表；
- 平台层不得直接调用 family-war API；
- family-war 模块不得反向依赖平台首页；
- 认证 Provider 仍位于模块路由之外，保证所有管理模块使用同一管理员会话；
- 业务请求继续使用 `/api/family-war/*`，管理端不得引入 Socket.IO；
- 未知 `/admin/*` 地址显示明确的 404 页面，不再静默跳回首页；
- 现有深层链接和浏览器前进、后退、刷新行为必须保持。

## Phase 1：冻结平台与模块边界

目标：根据现有代码建立可测试的应用注册和路由契约，避免重构过程中改变 URL 或认证行为。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 1a | 盘点 `App.jsx`、`AdminLayout`、认证组件和 family-war 模块之间的直接依赖，记录保留 URL、页面标题和导航行为 | `admin-client/src/`, 现有测试 | ✅ |
| 1b | 定义应用注册项字段：稳定 ID、显示名称、说明、入口路径、导航标签、图标和模块路由；禁止包含敏感配置 | `admin-client/src/app/appRegistry.js` | ✅ |
| 1c | 定义模块公开入口，只从 `modules/family-war/index.js` 导出路由和平台需要的元数据，不暴露内部实现文件 | `admin-client/src/modules/family-war/index.js` | ✅ |
| 1d | 为注册表增加唯一 ID、唯一路径、合法绝对管理路径和必填字段校验测试 | `admin-client/src/app/*.test.*` | ✅ |
| 1e | 冻结 `/admin/`、`/admin/family-war/`、`/admin/family-war/word-config` 的路由回归测试 | `admin-client/src/App.test.jsx` | ✅ |

## Phase 2：拆分应用装配与平台首页

目标：让顶层应用只负责 Provider 和路由装配，平台首页由注册表驱动。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 2a | 将 `AdminHomePage` 从 `App.jsx` 拆入独立页面组件，不改变现有文案和入口 URL | `admin-client/src/pages/AdminHomePage.jsx`, `admin-client/src/App.jsx` | ✅ |
| 2b | 建立集中路由装配文件，从 family-war 模块公开入口生成模块路由 | `admin-client/src/app/routes.jsx`, `admin-client/src/modules/family-war/index.js` | ✅ |
| 2c | 精简 `App.jsx`，只保留 Browser Router、Ant Design Provider、认证边界和顶层路由入口 | `admin-client/src/App.jsx`, `admin-client/src/app/AdminApp.jsx` | ✅ |
| 2d | 将应用入口卡片抽成复用组件，由注册表生成首页内容；没有已注册应用时显示明确空状态 | `admin-client/src/components/AppEntryCard.jsx`, `admin-client/src/pages/AdminHomePage.jsx` | ✅ |
| 2e | 增加首页渲染、注册应用导航、空注册表和模块路由装配测试 | `admin-client/src/**/*.test.*` | ✅ |

## Phase 3：完善平台导航与页面层级

目标：让管理端具备稳定的平台导航、当前位置反馈和异常路由处理。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 3a | 让 `AdminLayout` 的导航项由应用注册表生成，首页、模块页和模块子页选择状态保持正确 | `admin-client/src/layout/AdminLayout.jsx`, `admin-client/src/app/appRegistry.js` | ✅ |
| 3b | 增加统一页面头部，支持页面标题、面包屑、说明和右侧操作区，替换页面内重复标题结构 | `admin-client/src/components/PageHeader.jsx`, `admin-client/src/modules/family-war/` | ✅ |
| 3c | 为桌面宽度完善内容最大宽度、导航溢出和长标题布局；不扩大到手机端适配 | `admin-client/src/index.css`, `admin-client/src/layout/` | ✅ |
| 3d | 增加明确的 `/admin/*` 404 页面，提供返回管理首页操作；不得自动重定向掩盖错误链接 | `admin-client/src/pages/NotFoundPage.jsx`, 路由配置 | ✅ |
| 3e | 补充导航选中、面包屑、前进后退、深层链接和 404 页面测试 | `admin-client/src/**/*.test.*` | ✅ |

## Phase 4：统一请求状态与模块错误边界

目标：在不改变后端协议的前提下，让未来模块获得一致的加载和失败体验。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 4a | 盘点 family-war 页面现有 loading、空数据、401、普通 4xx/5xx 和网络错误展示，定义平台级状态组件接口 | `admin-client/src/modules/family-war/`, `admin-client/src/components/` | ✅ |
| 4b | 建立复用的加载、空状态和可重试错误组件，允许模块提供自己的说明和重试动作 | `admin-client/src/components/RequestState.jsx` | ✅ |
| 4c | 统一 API 请求错误对象，保留 HTTP 状态和服务端错误信息；401 继续交由现有认证流程处理 | `admin-client/src/config/`, `admin-client/src/modules/family-war/api.js`, `admin-client/src/auth/` | ✅ |
| 4d | 为顶层路由增加错误边界，捕获渲染异常并提供安全返回首页操作，不展示堆栈或敏感响应 | `admin-client/src/app/`, `admin-client/src/components/` | ✅ |
| 4e | 将 family-war 状态页和词库页接入统一状态组件，保持保存、换图、TTS 和恢复逻辑不变 | `admin-client/src/modules/family-war/` | ✅ |
| 4f | 增加成功、空数据、网络失败、401、500、重试和渲染异常测试 | `admin-client/src/**/*.test.*` | ✅ |

## Phase 5：自动化验收与兼容观察

目标：证明平台框架重构没有改变认证、family-war 管理功能或公网路径，并完成 v3.5 清理前的第二个观察周期。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 5a | 更新 Playwright Page Object 和定位器，减少对旧页面内部 DOM 层级的依赖 | `admin-client/tests/acceptance/pages/` | ✅ |
| 5b | 增加应用首页卡片、平台导航、面包屑、404、前进后退和深层路由刷新验收 | `admin-client/tests/acceptance/steps/` | ✅ |
| 5c | 回归管理员登录、刷新保持、登出、401、family-war 状态、词库、图片和 TTS | `admin-client/tests/acceptance/` | ✅ |
| 5d | 保持管理端网络边界断言：只请求 `/api/family-war/*`，不得请求任何 Socket.IO 或旧 API 路径 | `admin-client/tests/acceptance/runner.js` | ✅ |
| 5e | 执行管理端全部单元测试、acceptance 离线检查、生产构建和构建隔离验证 | `admin-client/`, 根项目脚本 | ✅ |
| 5f | 在预发布环境执行完整 acceptance，确认测试数据和管理员配置在成功、失败或中断后恢复 | 预发布环境、验收报告 | ✅ |
| 5g | 汇总 v3.3—v3.4 旧 API/Socket.IO 访问日志，排除验收、监控和扫描流量，形成 v3.5 是否允许清理的结论 | Nginx 兼容日志、`docs/acceptance/v3.4/` | ✅ |
| 5h | 继续运行新旧网关兼容测试；v3.4 仍不得删除旧 location | `server/tests/gateway.js`, Nginx 配置 | ✅ |

## Phase 6：版本发布与文档收尾

目标：发布不改变后端协议的管理框架版本，并把旧入口清理的最终执行责任交给 v3.5。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 6a | 将根项目和三个 package 版本统一更新为 `3.4.0`，同步 lockfile | 各级 `package.json`, `package-lock.json` | ✅ |
| 6b | 执行服务端、游戏端、管理端全部测试、Socket.IO 集成测试和完整生产构建 | 根项目、三个 package | ✅ |
| 6c | 部署管理端生产构建，验证 `/admin/`、family-war 模块、深层路由和 404 页面 | 正式环境 | ✅ |
| 6d | 确认服务端、游戏端、Nginx 标准入口及兼容入口没有行为变更 | 正式环境、网关验收 | ✅ |
| 6e | 更新项目结构、模块注册约定、测试命令、路线图和 v3.4 发布说明 | `README.md`, `AGENTS.md`, `road-map.md`, `docs/RELEASE.md` | ✅ |
| 6f | 发布 v3.4.0 Git tag 和 GitHub Release，说明该版本不包含认证后端改造或旧入口删除 | Git、GitHub Release | ✅ |
| 6g | 在 v3.5 计划中记录旧入口清理清单、观察门槛、回滚要求和 Socket.IO 禁止重定向规则 | `step.md`, `road-map.md` | ✅ |

## v3.4 最终验收条件

- 管理首页、导航和模块路由由同一份应用注册表驱动；
- 平台层不直接调用 family-war API，也不直接依赖模块内部页面文件；
- `/admin/`、`/admin/family-war/` 和词库深层链接保持不变；
- 未知管理 URL 显示明确 404 页面，不再静默跳回首页；
- 首页、导航、面包屑、加载、空状态和错误展示使用统一组件；
- 管理员登录、JWT Cookie、401 和登出行为与 v3.3 一致；
- family-war 状态、词库、图片和 TTS 功能与 v3.3 一致；
- 管理端继续只使用 `/api/family-war/*`，不安装或连接 Socket.IO；
- Koa 路由、Socket.IO、游戏前端和 PM2 行为没有修改；
- v3.3 标准入口与旧兼容入口均继续通过网关验收；
- 管理端单元测试、全量回归、生产构建和 Playwright acceptance 全部通过；
- v3.3—v3.4 兼容日志已形成可供 v3.5 使用的清理结论。

## 明确归入 v3.5

- 管理员认证接口从 family-war 业务状态接口中解耦；
- 管理员 Cookie、会话失效和登录限流的进一步完善；
- 为未来多管理员、权限和审计能力预留身份声明边界，完整能力继续延期；
- 删除 `/family-war/api/*` 兼容入口；
- 删除 `/family-war/socket.io/*` 兼容入口，不使用 HTTP 重定向；
- 更新网关测试和回滚说明，使其反映旧入口正式下线；
- 上述清理必须以 v3.3—v3.4 访问日志中不存在真实旧客户端为前置条件。

---

# v3.5：管理员认证解耦与旧入口清理实施计划

> 规划版本：v3.5.0
>
> 前置版本：v3.4.0
>
> 目标：将平台管理员身份接口从 family-war 业务管理接口中解耦，并在 v3.3—v3.4 兼容观察门槛满足后，下线 v3.2 遗留的公网 API 与 Socket.IO 入口。
>
> 核心边界：本版本仍只服务单一管理员登录，继续使用现有管理员密码配置和管理员 JWT Secret；不实现微信认证、普通用户身份、多管理员账号或完整 RBAC。

## 1. 当前基础与目标契约

v3.4 当前认证和业务接口共用 family-war 管理前缀：

```text
POST /api/family-war/admin/login
POST /api/family-war/admin/logout
GET  /api/family-war/admin/status       # 同时被用于登录状态探测

GET  /api/family-war/admin/word-config
POST /api/family-war/admin/word-config
```

v3.5 将平台身份接口和 family-war 业务管理接口分开：

```text
# 平台管理员身份
POST /api/admin-auth/login
GET  /api/admin-auth/me
POST /api/admin-auth/logout

# family-war 业务管理
GET  /api/family-war/admin/status
GET  /api/family-war/admin/word-config
POST /api/family-war/admin/word-config
...
```

认证接口使用独立的 `admin_session` HttpOnly Cookie。JWT 继续由当前管理员 `jwtSecret` 签发，但必须带有明确的管理员令牌类型或受众声明，认证中间件只接受管理员令牌。未来微信或平台普通用户 Token 不得直接复用管理员 Cookie、声明空间和验证边界；是否使用独立 Secret 或独立签发服务留到对应身份版本设计。

v3.5 发布后的公网入口：

| 类型 | 标准入口 | v3.2 旧入口 | v3.5 结果 |
|------|----------|--------------|------------|
| 游戏页面 | `/family-war/` | 同左 | 保持 |
| 管理页面 | `/admin/` | 同左 | 保持 |
| 平台管理员认证 | `/api/admin-auth/*` | 无独立入口 | 新增 |
| family-war API | `/api/family-war/*` | `/family-war/api/*` | 删除旧入口 |
| family-war Socket.IO | `/socket/family-war/*` | `/family-war/socket.io/*` | 删除旧入口，不重定向 |

Koa 内部 family-war 业务路由仍使用 `/api/admin/*`、`/api/images/*` 等现有路径，Socket.IO 内部 path 仍为 `/socket.io/`。本版本只新增独立认证路由并调整中间件职责，不借机重命名全部服务端业务路由。

## 2. 本版本范围

v3.5 包含：

- 新建独立管理员认证模块，提供登录、当前管理员和退出接口；
- 将登录限流、请求来源校验、Cookie 签发和管理员 JWT 校验收拢到认证模块；
- 管理端使用独立认证服务，不再通过 family-war 状态接口探测登录状态；
- 将认证接口和 family-war 业务接口配置为两个独立 Service Base；
- 保持单一管理员密码，不引入数据库和账号表；
- 使用独立命名的 `admin_session` Cookie，并明确安全属性和失效行为；
- 扩充服务端、管理端和 Playwright 认证测试；
- 再次核对 v3.3—v3.4 兼容日志增量，形成可审计的下线结论；
- 删除 Nginx `/family-war/api/*` 和 `/family-war/socket.io/*` 旧 location；
- 更新网关验收，使旧入口下线成为明确断言；
- 完成预发布回滚演练、正式发布和兼容日志收尾。

v3.5 不包含：

- 微信登录、OAuth、平台普通用户或游戏玩家身份；
- 家庭关系、儿童档案、当前活动档案或角色与真实身份绑定；
- 多管理员账号、密码哈希数据库、管理员邀请和找回密码；
- 完整 RBAC、应用级授权管理页面或审计日志平台；
- 修改 family-war 游戏事件、房间状态、玩法或 Socket.IO 内部协议；
- 修改 `/family-war/`、`/admin/`、`/api/family-war/` 和 `/socket/family-war/` 标准入口；
- 使用 301/302 将旧 Socket.IO 入口重定向到新入口；
- 保证 v3.2 前端构建在不恢复旧 Nginx location 的情况下可以回滚运行。

## 3. 设计与发布约束

- 管理员身份模块不得依赖 `roomManager`、`gameManager`、词库或图片管理实现；
- family-war 管理路由只消费认证中间件写入的管理员身份，不负责登录、退出或 Token 签发；
- `GET /api/admin-auth/me` 是唯一的前端会话探测接口，不得通过业务状态接口替代；
- 登录成功、退出和认证失败的响应不得返回 JWT；Token 只通过 HttpOnly Cookie 传递；
- `admin_session` 至少使用 `HttpOnly`、`SameSite=Lax`、`Path=/`，生产 HTTPS 环境启用 `Secure`；
- 登录限流只匹配新的登录接口，不得误伤 family-war 普通管理请求；
- 修改状态的认证及业务 POST 请求继续校验同源请求；
- 日志可以记录成功、失败、限流和失效原因，但不得记录密码、JWT、Cookie 或完整敏感请求头；
- 管理员 JWT Secret 缺失时的开发行为和生产启动策略必须有测试和文档，不在运行日志输出随机 Secret；
- 旧入口下线是独立发布动作：必须先完成标准入口验收和配置备份，失败时只恢复旧 location，不先回滚认证代码；
- 删除旧 Socket.IO location 后应直接不可用，不提供普通 HTTP 重定向；
- 兼容日志若发现无法排除的真实旧客户端，旧入口清理步骤暂停，但认证解耦可以继续发布。

## 4. 发布门槛与回滚原则

旧入口允许下线必须同时满足：

1. v3.3—v3.4 已覆盖至少一个完整版本观察周期；
2. 发布前再次检查兼容日志增量；
3. 排除项目自身网关测试、验收脚本、监控健康检查和明显扫描流量；
4. 没有可识别的真实 v3.2 游戏端或管理端客户端；
5. 标准 API、图片、Socket.IO polling 和 WebSocket 已在预发布通过；
6. 旧 Nginx location 已保存为可直接恢复的配置片段；
7. 网关测试能够分别证明标准入口可用和旧入口不可用。

回滚分为两层：

- **认证回滚**：恢复 v3.4 服务端与管理端构建，并恢复旧 `admin_token` 认证流程；允许管理员重新登录，不迁移或转换 Token；
- **网关回滚**：恢复备份的 `/family-war/api/*` 与 `/family-war/socket.io/*` location，执行 `nginx -t` 后重载；
- 若仅旧客户端兼容出现问题，优先只恢复旧 location，不回滚 v3.5 标准入口和新前端；
- 回滚到 v3.2 前端时必须同时恢复旧 location；只恢复旧构建产物不足以完成回滚；
- 本版本无数据库迁移，回滚不涉及数据转换。

## Phase 1：冻结认证契约与清理门槛

目标：先确定身份接口、Cookie、安全属性、兼容范围和旧入口下线证据，避免实施中同时改变多项协议。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 1a | 盘点当前登录、退出、状态探测、认证中间件、限流、来源校验和 Cookie 行为，记录 v3.4 响应及错误语义 | `server/src/routes/admin.js`, `server/src/middleware/auth.js`, `admin-client/src/auth/`, 现有测试 | ✅ |
| 1b | 冻结 `/api/admin-auth/login`、`/api/admin-auth/me`、`/api/admin-auth/logout` 的方法、请求体、成功响应、401、403、429 和 Cookie 契约 | `step.md`, 服务端测试设计 | ✅ |
| 1c | 确定本版本继续使用单一管理员密码和现有管理员 JWT Secret；定义管理员 Token 类型/受众声明，明确未来普通用户 Token 不直接复用该验证边界 | `server/config.js`, 认证设计说明 | ✅ |
| 1d | 冻结 `admin_session` Cookie 的名称、有效期、Path、HttpOnly、SameSite、Secure 和删除属性；明确升级后允许管理员重新登录 | 认证设计说明、测试清单 | ✅ |
| 1e | 汇总 v3.3—v3.4 兼容日志及发布前增量，排除验收、监控和扫描流量，输出旧 API 与 Socket.IO 是否允许下线的独立结论 | Nginx 兼容日志、`docs/acceptance/v3.5/` | ✅ |
| 1f | 导出旧 Nginx location 配置片段，记录恢复命令、验证命令和负责人可执行的回滚清单 | Nginx 配置备份、`docs/acceptance/v3.5/rollback.md` | ✅ |
| 1g | 增加契约级失败测试或测试清单，覆盖错误密码、缺少 Cookie、过期/篡改/错误类型 Token、跨源 POST 和限流 | `server/__tests__/`, `admin-client/src/**/*.test.*` | ✅ |

## Phase 2：拆分服务端管理员认证

目标：让身份签发和会话查询成为独立平台能力，family-war 管理路由只保留业务职责。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 2a | 新建管理员认证路由或服务，迁移密码校验、JWT 签发、Cookie 设置与清除逻辑 | `server/src/routes/adminAuth.js`, `server/src/auth/` 或实际等价目录 | ✅ |
| 2b | 实现 `POST /api/admin-auth/login`：校验单一管理员密码，签发管理员 Token，仅设置 `admin_session` Cookie | `server/src/routes/adminAuth.js` | ✅ |
| 2c | 实现 `GET /api/admin-auth/me`：验证会话并返回最小管理员信息，不读取 family-war 房间或业务状态 | `server/src/routes/adminAuth.js`, 认证中间件 | ✅ |
| 2d | 实现 `POST /api/admin-auth/logout`：无论 Cookie 是否存在都幂等清除 `admin_session`，返回成功 | `server/src/routes/adminAuth.js` | ✅ |
| 2e | 重构认证中间件，分别处理身份接口白名单和受保护的 family-war 管理路由；统一过期、篡改和错误类型 Token 的 401 语义 | `server/src/middleware/auth.js`, `server/src/index.js` | ✅ |
| 2f | 将登录限流和来源校验切换到新认证路径，同时覆盖 family-war 修改类管理请求，不扩大到游戏 Socket.IO | `server/src/middleware/auth.js` | ✅ |
| 2g | 从 family-war 管理路由删除登录和退出职责，保留状态、词库和图片管理接口及其响应结构 | `server/src/routes/admin.js` | ✅ |
| 2h | 增加管理员身份接口和业务授权测试，覆盖 Cookie 属性、`me`、登出幂等、限流、来源校验、业务 401 及无密码配置策略 | `server/__tests__/adminAuth.test.js`, 相关测试 | ✅ |

## Phase 3：切换管理端认证服务

目标：管理端通过独立身份服务维护管理员会话，family-war 模块 API 只处理业务请求。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 3a | 在服务配置中增加独立 `ADMIN_AUTH_API_BASE`，继续保留 `FAMILY_WAR_API_BASE`；开发代理和生产路径分别验证 | `admin-client/src/config/`, `admin-client/vite.config.js`, 环境示例 | ✅ |
| 3b | 新建平台级管理员认证 API 封装，实现 `login`、`getCurrentAdmin` 和 `logout`，禁止 family-war 模块导出认证方法 | `admin-client/src/auth/api.js`, `admin-client/src/modules/family-war/api.js` | ✅ |
| 3c | 将 `RequireAdminAuth` 的启动探测从 family-war `status` 改为 `/api/admin-auth/me`，保持登录后原目标页恢复 | `admin-client/src/auth/RequireAdminAuth.jsx` | ✅ |
| 3d | 更新管理员上下文和布局退出流程，401 时统一清理前端认证状态并显示登录页，不在浏览器存储 Token | `admin-client/src/auth/`, `admin-client/src/layout/` | ✅ |
| 3e | 保持 family-war 状态、词库、图片和 TTS 页面行为及 URL 不变，只替换认证依赖 | `admin-client/src/modules/family-war/` | ✅ |
| 3f | 更新单元测试，覆盖首次探测、登录、刷新保持、深层链接恢复、过期、退出、401 和认证服务网络失败 | `admin-client/src/**/*.test.*` | ✅ |
| 3g | 增加网络边界断言：认证请求只访问 `/api/admin-auth/*`，业务请求只访问 `/api/family-war/*`，管理端仍不得连接 Socket.IO | `admin-client/src/**/*.test.*`, acceptance | ✅ |

## Phase 4：扩充网关和自动化验收

目标：在修改生产 Nginx 前，让自动化能够验证新认证入口、标准业务入口和旧入口下线结果。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 4a | 扩充网关测试配置，分别接受认证 Base、family-war API Base、Socket.IO path 和预期旧入口状态 | `server/tests/gateway.js`, 根项目脚本 | ⬜ |
| 4b | 增加 `/api/admin-auth/*` 经过真实 Nginx 的登录、`me`、退出和 Cookie 验收，不在输出中打印 Cookie 或 Token | `server/tests/gateway.js` 或独立认证网关测试 | ⬜ |
| 4c | 保持标准 `/api/family-war/*`、图片、Socket.IO polling-only 和 WebSocket-only 全链路验收 | `server/tests/gateway.js` | ⬜ |
| 4d | 将旧入口断言从“必须兼容”改为“不得成功代理到 family-war 服务”；明确允许的下线状态，不接受 301/302 到标准入口 | `server/tests/gateway.js` | ⬜ |
| 4e | 更新管理端 Playwright Page Object 和认证步骤，验证 `admin_session`、`me`、刷新保持、登出、401 和限流恢复 | `admin-client/tests/acceptance/` | ⬜ |
| 4f | 更新 acceptance 配置边界，分别提供管理页面地址、认证 API 地址和 family-war API 地址 | `admin-client/tests/acceptance/config.js`, `runner.js`, 文档 | ⬜ |
| 4g | 执行服务端、游戏端、管理端单元测试、Socket.IO 集成、acceptance 离线检查、生产构建和构建隔离验证 | 根项目、三个 package | ⬜ |

## Phase 5：预发布切换、旧入口下线与回滚演练

目标：按可分步回滚的顺序在预发布完成认证切换和旧入口清理，不把两类风险合并为一次不可诊断的变更。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 5a | 部署带独立认证接口的服务端，先通过内部端口验证新认证接口和原 family-war 业务接口 | 预发布服务、PM2 | ⬜ |
| 5b | Nginx 增加 `/api/admin-auth/` 标准入口，执行 `nginx -t` 后重载；暂时保留两个旧 v3.2 location | 预发布 Nginx | ⬜ |
| 5c | 部署管理端生产构建，执行完整 Playwright acceptance，确认登录、刷新、深层链接、业务管理和登出正常 | `admin-client/build/`, 预发布环境 | ⬜ |
| 5d | 验证管理端网络只出现 `/api/admin-auth/*` 和 `/api/family-war/*`，没有旧 API、Socket.IO 或 Token 暴露 | 浏览器网络记录、Nginx 日志 | ⬜ |
| 5e | 在删除前最后检查兼容日志增量；若发现无法排除的真实旧客户端，停止 5f—5i，继续完成认证回滚演练，并保留书面阻断结论 | 兼容日志、`docs/acceptance/v3.5/` | ⬜ |
| 5f | 删除 `/family-war/api/*` 旧 location，验证旧 API 不再代理或重定向，标准 API、认证和图片链路仍正常 | 预发布 Nginx、网关测试 | ⬜ |
| 5g | 删除 `/family-war/socket.io/*` 旧 location，不增加 301/302；验证旧 polling/WebSocket 失败且标准 Socket.IO 两种传输正常 | 预发布 Nginx、网关测试 | ⬜ |
| 5h | 执行管理端 acceptance、游戏端 E2E、标准网关和完整生产构建验收，检查浏览器、Nginx、PM2 和服务端日志 | 预发布环境、验收报告 | ⬜ |
| 5i | 演练仅恢复两个旧 location：执行语法检查和重载，确认 v3.2 旧 API/Socket.IO 恢复，再重新执行下线 | 预发布 Nginx、回滚报告 | ⬜ |
| 5j | 演练认证回滚：恢复 v3.4 服务端和管理端后可重新登录；随后恢复 v3.5 并确认无数据迁移或残留配置 | 预发布环境、回滚报告 | ⬜ |
| 5k | 形成预发布验收报告，记录路径矩阵、Cookie 安全属性、日志门槛、回滚耗时和正式发布批准条件 | `docs/acceptance/v3.5/phase-5-report.md` | ⬜ |

## Phase 6：正式发布、观察与版本收尾

目标：复用预发布顺序完成正式发布，并确认管理员认证解耦和旧入口下线均可独立验证、独立回滚。

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| 6a | 将根项目和三个 package 版本统一更新为 `3.5.0`，同步 lockfile | 各级 `package.json`, `package-lock.json` | ⬜ |
| 6b | 执行全部单元测试、Socket.IO 集成、管理端 acceptance 离线检查、游戏端 E2E 清单、完整生产构建和构建隔离验证 | 根项目、三个 package | ⬜ |
| 6c | 按 5a—5d 顺序发布服务端、认证 Nginx 入口和管理端构建，先验证新认证与全部标准入口 | 正式环境 | ⬜ |
| 6d | 再次检查正式环境旧入口日志增量；满足门槛后删除旧 API location，验证通过后再删除旧 Socket.IO location | 正式环境、Nginx | ⬜ |
| 6e | 执行正式环境完整验收：管理员认证、family-war 管理、游戏页面、图片、标准 API、polling 和 WebSocket；旧入口不得成功或重定向 | 正式环境、验收报告 | ⬜ |
| 6f | 观察 Nginx、PM2 和服务端日志，确认无新增认证错误、代理循环、异常 30x、Socket.IO 握手失败或集中 4xx/5xx | 正式环境 | ⬜ |
| 6g | 更新认证架构、环境配置、Nginx 路径、测试命令、回滚说明、路线图和发布说明 | `README.md`, `AGENTS.md`, `road-map.md`, `docs/ROUTING-MIGRATION-PLAN.md`, `docs/RELEASE.md` | ⬜ |
| 6h | 发布 v3.5.0 Git tag 和 GitHub Release，明确管理员需要重新登录、旧入口已下线及回滚要求 | Git、GitHub Release | ⬜ |
| 6i | 在约定观察期保留旧 location 备份但不启用；观察结束且无回滚需求后，归档兼容日志和下线报告 | 运维备份、`docs/acceptance/v3.5/release-report.md` | ⬜ |

## v3.5 最终验收条件

- `/api/admin-auth/login`、`/me`、`/logout` 通过标准公网入口工作；
- 登录状态探测不再读取 family-war 房间或比赛状态；
- 管理员身份模块不依赖 family-war 业务管理器、词库或图片实现；
- 管理端认证请求只使用 `/api/admin-auth/*`，业务请求只使用 `/api/family-war/*`；
- `admin_session` 只通过 HttpOnly Cookie 传递，安全属性、过期和删除行为符合契约；
- 错误密码、限流、跨源 POST、缺失/过期/篡改/错误类型 Token 均有自动化覆盖；
- 管理首页、family-war 状态、词库、图片、TTS、深层链接和 404 行为与 v3.4 一致；
- `/family-war/api/*` 不再代理到服务端，也不重定向到标准 API；
- `/family-war/socket.io/*` 的 polling 和 WebSocket 均不再可用，且不存在 301/302；
- `/api/family-war/*`、`/socket/family-war/*`、图片和两个 Socket.IO 传输继续通过真实 Nginx 验收；
- `/family-war/`、`/admin/` 页面路径和服务端内部 Socket.IO 事件协议保持不变；
- 旧入口下线前具有可复核日志结论，下线后具有独立 Nginx 回滚配置和演练记录；
- 服务端、游戏端、管理端测试、Socket.IO 集成、生产构建及预发布 acceptance 全部通过；
- 文档、发布说明、自动化断言和正式 Nginx 行为一致。

## 明确延期到后续版本

- 微信登录及其他第三方身份提供方；
- 平台普通用户 Token、刷新令牌和 Socket.IO 用户认证；
- 家庭关系、儿童档案、当前活动档案和游戏角色身份映射；
- 多管理员账号、账号数据库、密码哈希迁移、邀请和找回流程；
- 完整 RBAC、权限配置页面和集中审计平台；
- `family-war:view`、`family-war:word-config`、`family-war:image-manage` 等权限可作为声明设计预留，但 v3.5 不强制执行；
- 将管理员认证拆成独立进程、独立域名或集中式身份服务；
- 修改 Koa 内部 `/api/*`、Socket.IO `/socket.io/` path 或业务事件协议。
