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
| 3e | candidateId 机制 | `server/src/unsplashClient.js`, `server/src/routes/admin.js` | ⬜ |
| 3f | Phase 3 测试 | `server/__tests__/adminAuth.test.js`, `client/src/__tests__/RequireAuth.test.jsx` | ⬜ |

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
| 4a | 客户端保存当前昵称和房间 ID，在 `socket.on('connect', ...)` 后自动重发 `room:join` | `client/src/App.jsx` | ⬜ |
| 4b | 避免首次进入和重连恢复重复触发 toast、BGM 重启或重复事件监听 | `client/src/App.jsx`, `client/src/pages/Room.jsx` | ⬜ |
| 4c | 服务端确认重复加入同一房间的行为安全：不会残留旧角色、不会重复机器人、不会污染在线玩家列表 | `server/src/socket/roomManager.js`, `server/src/socket/handler.js` | ⬜ |
| 4d | 补充客户端重连测试和必要的服务端房间状态测试 | `client/src/__tests__/App.test.jsx`, `server/__tests__/roomManager.test.js` | ⬜ |

**验收条件**

- 网络短暂断开并恢复后，客户端能自动重新获得房间状态
- 重连不会自动恢复已刷新页面丢失的身份，除非后续单独设计本地持久化
- 重连过程不会造成重复玩家、重复提示、重复 BGM 或重复 socket 监听
- 断线发生在游戏中时，当前版本行为有明确测试覆盖或边界说明

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
