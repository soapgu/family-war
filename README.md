# Family War 🎮

一个线上石头剪刀布游戏系统，支持多人在线对战以及和机器人对局。

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | React + react-app-rewired + Antd + JS |
| 后端 | Koa + @koa/router + JS |
| 实时通信 | Socket.IO（模块级单例，不依赖 React 生命周期） |
| UI 库 | Antd v5 |
| 测试框架 | Jest + React Testing Library |
| 测试策略 | TDD（先写测试后实现） |
| 管理接口 | Koa REST 路由 |
| 数据库 | 无（纯内存） |

## 目录结构

```
family-war/
├── client/                                   # React 前端 (端口 3000)
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── logo.svg
│   │   └── index.html
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── Home.test.js                   # 首页 TDD 测试 (5 个)
│   │   │   ├── Room.test.js                   # 房间页 TDD 测试 (9 个)
│   │   │   ├── RoleCard.test.js               # 角色卡片 TDD 测试 (7 个)
│   │   │   └── Admin.test.js                  # 后台页 TDD 测试 (3 个)
│   │   ├── pages/
│   │   │   ├── Home.js                        # 首页：输入昵称（纯 UI，无 socket/routing）
│   │   │   ├── Room.js                        # 房间页：选角色、挑战、对战（纯 props 组件）
│   │   │   └── Admin.js                       # 后台：房间状态 + 对局记录
│   │   ├── components/
│   │   │   ├── RoleCard.js                    # 角色卡片（空闲/选中/对战中）
│   │   │   ├── GameBoard.js                   # 对战面板（石头剪刀布按钮）
│   │   │   └── MatchResult.js                 # 结算弹窗
│   │   ├── hooks/
│   │   │   ├── __mocks__/
│   │   │   │   └── useSocket.js               # Socket mock（测试用）
│   │   │   └── useSocket.js                   # Socket.IO 模块级单例
│   │   ├── setupProxy.js                      # CRA 代理 /api → :4000
│   │   ├── setupTests.js                      # Jest 全局配置 + matchMedia mock + 抑制 React Router 警告
│   │   ├── App.js                             # GameApp 容器，state 控制 Home/Room 切换
│   │   └── index.js
│   ├── jsconfig.json
│   ├── config-overrides.js
│   └── package.json
├── server/                         # Koa 后端 (端口 4000)
│   ├── __tests__/
│   │   ├── roomManager.test.js     # roomManager 单元测试 (24 个)
│   │   └── gameManager.test.js     # gameManager 单元测试 (22 个)
│   ├── tests/
│   │   └── integration.js          # 集成测试 (21 个断言)
│   ├── src/
│   │   ├── index.js                # Koa + Socket.IO 启动入口
│   │   ├── socket/
│   │   │   ├── handler.js          # 事件注册路由
│   │   │   ├── roomManager.js      # 房间/角色状态管理（内存）
│   │   │   └── gameManager.js      # 猜拳判定 + 三局两胜 + 断线处理
│   │   └── routes/
│   │       └── admin.js            # Koa REST 管理接口
│   ├── jsconfig.json               # VSCode JS 类型提示
│   └── package.json
└── package.json                    # 顶层 concurrent 启动
```

## 前端架构

```
App (BrowserRouter)
├── /admin → Admin
└── * → GameApp (状态容器)
    ├── roomState = null  →  Home
    │   └── onEnter(nickname) → emit room:join → setRoomState
    └── roomState ≠ null  →  Room
        ├── 选角色 / 挑战 / 对战
        └── onBack() → setRoomState(null) 返回首页
```

- Home 和 Room 之间没有 URL 切换，由 `GameApp` 的 state 控制渲染
- 刷新页面时 state 丢失，回退到 Home 界面，不产生死页面
- `socket.io` 客户端是模块级单例，不受 React 生命周期影响

## 游戏流程

```
首页(输入昵称) → 进入房间 → 选择角色 → 挑战 → Ready Go(首局) → 翻骰动画 → 出拳 → 结算
```

| 步骤 | 行为 | 通讯 |
|------|------|------|
| 进入房间 | 输入昵称，加入默认房间，开始播放大厅 BGM | `socket.emit('room:join', { nickname })` |
| 选角色 | 点击 爸爸/妈妈/儿子 角色卡，伴有选中/取消音效 | `socket.emit('role:select', { role })` |
| 发起挑战 | 选角后点击 ⚔️ 挑战按钮，伴有冲锋号角音效 | `socket.emit('game:challenge', { targetId })` |
| Ready Go | 比赛首局播放 3 秒倒计时动画，切换到对战 BGM | 客户端本地动画 |
| 翻骰动画 | 出拳阶段上方滚筒轮换 ✊✋✌️，伴有翻骰节拍音效 | 客户端本地动画 |
| 双方出拳 | 点击出拳按钮，滚筒定格 + punch 音效 → 交锋动画展示结果 | `socket.emit('game:move', { choice })` |
| 判定结果 | 服务器比对，广播本局结果 | 客户端收到 `game:roundResult` |
| 赛果 | 先赢 2 局者胜，切换到结算 BGM | 客户端收到 `game:matchResult` |

## 游戏规则

| 规则 | 内容 |
|------|------|
| 赛制 | 三局两胜（先赢 2 局者获胜） |
| 挑战 | 选角后点击下方 ⚔️ 挑战按钮 → 直接开始，无确认弹窗 |
| 平局 | 该局无效，双方不得分，继续下一局直到出现赢家 |
| 断线 | 立即结束比赛，整场比赛结果无效，双方回到房间空闲状态 |
| 记分 | 不计分，纯判定胜负 |
| 房间 | 默认 `default`，后期支持多房间（设计预留 roomId） |
| 角色 | 爸爸/妈妈/儿子/机器人，一人一角色，选了自动 ready。机器人角色不可被选择 |
| 旁观 | 暂不支持 |

## 机器人 🤖

房间中有一个**常驻机器人**，不可被人类选择，永远在线。

| 特性 | 说明 |
|------|------|
| 身份 | 虚拟玩家，占用 `'机器人'` 角色，ID 为 `__robot__` |
| 选择方式 | 和挑战其他玩家一样，在挑战列表中点击机器人即可发起对战 |
| 出牌策略 | 纯随机（rock/paper/scissors 等概率），无任何策略应对 |
| 出牌时机 | 人类出拳后，服务器即时为机器人出拳并结算，无等待 |
| 重赛/认输 | 和普通对局一样，支持重赛和认输 |
| 对局历史 | 与机器人的对局同样记录到对局历史和管理后台 |
| 角色卡片 | 机器人角色卡片为紫色主题(🤖)，始终不可点击 |

## 音效与背景音乐 🎵

### 背景音乐（BGM）

通过监听 `roomState.game.status` 自动切换三种 BGM，由 `App.js` 统一管理：

| 阶段 | 触发条件 | 文件路径 | 循环 |
|------|---------|---------|------|
| 大厅 | 进入房间 / 比赛结束返回 | `/bgm.mp3` | ✅ |
| 对战 | `game.status === 'playing'` | `/bgm_battle.mp3` | ✅ |
| 结算 | `game.status === 'match_end'` | `/bgm_result.mp3` | ✅ |

三首 BGM 均循环播放，音量 0.3。离开房间或组件卸载时自动停止。点击「返回房间」时主动切回大厅 BGM。

### UI 交互音效（Web Audio API）

所有 UI 音效由 Web Audio API 实时合成，无需外部音频文件：

| 音效 | 触发 | 实现 | 听感 |
|------|------|------|------|
| 选中角色 | 点击空闲角色卡 | 正弦波 C5↗E5，120ms | 「叮↑」积极肯定 |
| 取消角色 | 点击已选角色卡 | 正弦波 D5↘A4，120ms | 「叮↓」释放 |
| 挑战 | 点击 ⚔️ 挑战按钮 | 方波 150↗500Hz + 锯齿波 300↗1000Hz，250ms | 冲锋号角 |
| 出拳 | 点击出拳按钮 | 方波 100↘30Hz，180ms | 「砰」击打感 |
| 翻骰节拍 | 出拳滚筒每 2 次跳动 | 正弦波 800Hz，30ms | 微弱滴答节拍 |

技术细节：
- `getAudioContext(audioCtxRef)` — 复用单一 `AudioContext` 实例，自动处理浏览器 `suspended` 恢复
- `playSfx(audioCtxRef, freqStart, freqEnd, duration)` — 通用正弦波滑音
- `playBattleSfx(audioCtxRef)` — 双层波形合成（square + sawtooth）
- `playPunchSfx(audioCtxRef)` / `playRollTickSfx(audioCtxRef)` — 出拳阶段专用

### 音频文件部署

```
client/public/
├── bgm.mp3          # 大厅背景音乐
├── bgm_battle.mp3   # 对战背景音乐
├── bgm_result.mp3   # 结算背景音乐
└── readygo.mp3      # Ready Go 音效（≈3秒）
```

## Ready Go 动画 ⚡

每场**比赛首局**开始前播放 3 秒倒计时动画，参考泡泡龙风格：

```
0s        1.5s       2.5s      3s
├─ READY ─┤─ GO! ────┤ 淡出 ──┤ 进入出拳阶段
├────── readygo.mp3 播放 ──────────┤
```

- **READY**：金黄色 56px，弹缩入场（`readyGoBounceIn`：0.3→1.15→0.9→1.0）
- **GO!**：红色 72px，更大冲击力的弹缩入场
- **遮罩**：`position: fixed` 全屏半透明黑底（`rgba(0,0,0,0.6)`），GO 后 2.5s 开始渐隐出
- 仅比赛首局出现，后续局数直接进入出拳阶段
- 重赛时重新播放

## 出拳翻骰动画 🎰

`choosing` 阶段上方有一个独立滚筒区域，快速轮换 ✊→✋→✌️（120ms/次），下方三个出拳按钮保持静态：

```
     ┌──────────────┐
     │     ✊       │  ← 120ms 快速轮换 + 翻骰节拍音效
     │  👆 选一个出拳 │
     └──────────────┘

   [✊ 石头]  [✋ 布]  [✌️ 剪刀]   ← 静态按钮，hover 高亮
```

点击后：滚筒定格在选中 emoji（放大 + 绿色光晕 + `rollStop` 弹跳动画）+ punch 音效 → 350ms 后进入 waiting。

## Socket 事件清单

| 方向 | 事件 | 数据 | 说明 |
|------|------|------|------|
| C→S | `room:join` | `{ nickname }` | 加入默认房间 |
| C→S | `room:leave` | — | 离开 |
| C→S | `role:select` | `{ role }` | 选角色（爸爸/妈妈/儿子，机器人不可选） |
| C→S | `role:deselect` | — | 放弃当前角色 |
| C→S | `game:challenge` | `{ targetId }` | 点击对手发起挑战 |
| C→S | `game:move` | `{ choice }` | 出拳（rock/paper/scissors） |
| C→S | `game:rematch` | — | 再来一局 |
| C→S | `game:forfeit` | — | 认输回房 |
| S→C | `room:state` | 完整房间 | 每次状态变更推送 |
| S→C | `game:start` | `{ opponent, round }` | 开局 |
| S→C | `game:waiting` | — | 等待对手出拳 |
| S→C | `game:roundResult` | `{ round, winner, yourMove, oppMove, scores }` | 本局结果（含交锋动画） |
| S→C | `game:matchResult` | `{ matchWinner, scores, history }` | 赛果弹窗 |
| S→C | `game:cancelled` | `{ message }` | 比赛因对手离开取消 |
| S→C | `game:forfeited` | `{ message }` | 对手认输 |
| S→C | `game:error` | `{ message }` | 错误提示 |
| S→C | `player:joined` | `{ nickname }` | 有人进房 |
| S→C | `player:left` | `{ socketId }` | 有人离房 |

## 后台管理

无数据库，当前提供纯监控页面：

- 当前房间状态（谁在线、选了谁、是否对战中）
- 已完成对局记录（存在内存数组中）
- API: `GET /api/admin/status` → 房间列表 + 历史对局

## 测试

| 项目 | 说明 |
|------|------|
| 框架 | Jest v29（server/ 和 client/ 均使用） |
| 服务端单元测试 | `server/__tests__/roomManager.test.js`、`server/__tests__/gameManager.test.js` |
| 服务端集成测试 | `server/tests/integration.js`（真实 Socket 连接走完整流程） |
| 前端单元测试 | `client/src/__tests__/*.test.js`（React Testing Library + Antd） |
| 类型 | `@types/jest` + `jsconfig.json` 提供 VSCode 智能提示 |

### 运行测试

```bash
# 服务端单元测试（根目录）
npm test

# 服务端单元测试（watch 模式）
npm test:watch --prefix server

# 服务端集成测试
npm run test:integration

# 前端单元测试（需 cd client）
npm test --prefix client
```

### 测试覆盖

| 分组 | 模块 | 类型 | 用例数 |
|------|------|------|--------|
| joinRoom / leaveRoom | roomManager | 单元 | 5 |
| selectRole / deselectRole | roomManager | 单元 | 7 |
| handleDisconnect | roomManager | 单元 | 3 |
| getRoomState | roomManager | 单元 | 2 |
| broadcastRoomState | roomManager | 单元 | 2 |
| getAdminStatus | roomManager | 单元 | 2 |
| setGame / clearGame | roomManager | 单元 | 3 |
| createGame | gameManager | 单元 | 1 |
| submitMove | gameManager | 单元 | 11 |
| handleDisconnect | gameManager | 单元 | 4 |
| getGame | gameManager | 单元 | 3 |
| getMatchHistory | gameManager | 单元 | 3 |
| 完整游戏流程 | handler | 集成 | 21 |
| Home 渲染 + 回调 | client Home | 前端单元 | 5 |
| Room 渲染 + 交互 | client Room | 前端单元 | 10 |
| RoleCard 渲染 + 交互 | client RoleCard | 前端单元 | 7 |
| Admin 渲染 + 数据 | client Admin | 前端单元 | 3 |
| **总计** | | | **92** |

## 端口

| 服务 | 端口 |
|------|------|
| client (React) | 3000 |
| server (Koa) | 4000 |

- **server**: 4000（Koa + Socket.IO）
- **client**: 3000（React 开发服务器）
- 开发环境下 socket.io 客户端通过 `window.location.hostname` 动态拼接服务器地址，支持局域网 IP 访问（CORS 已配置）
- `/api` 请求通过 CRA 代理 (`setupProxy.js`) 转发到 4000



## 实现步骤

### 服务端（已完成）

- [x] 1. 初始化项目结构：client（CRA+rewired）、server（Koa+socket.io）、根 package.json
- [x] 2. roomManager.js — 房间 CRUD、角色分配、在线状态管理（含 24 个单元测试）
- [x] 3. gameManager.js — 猜拳判定、三局两胜赛制、平局重赛、断线结束比赛（含 19 个单元测试）
- [x] 4. handler.js — 注册所有 socket 事件（含集成测试 21 个断言验证）
- [x] 5. admin.js — GET /api/admin/status 管理接口（含对局历史记录）

### 前端（进行中）

**第一阶段：脚手架 + TDD 基础设施**
- [x] 6a. 安装 antd + 测试依赖，建空壳页面 Home/Room/Admin，确认路由切换正常
- [x] 6b. 为三页面写 TDD 测试（空状态渲染），配置 useSocket mock

**第二阶段：功能分步实现**
- [x] 7a. **A — 进入游戏**：Home 输入昵称 → emit room:join → GameApp 收到 room:state 切换为 Room
- [x] 7b. **B — 角色选择**：Room + RoleCard 展示三角色，选/弃角色，实时同步

**第三阶段：UI 全面优化**
- [x] 7o1. **Home 首页优化**：渐变背景、玻璃态卡片、加载态按钮、自动聚焦、错误处理
- [x] 7o2. **RoleCard 角色卡片优化**：Emoji 图标、角色专属配色、视觉提升
- [x] 7o3. **Room 房间页优化**：玩家在线列表、进出房间 Toast 通知、响应式布局

**第四阶段：游戏核心功能**
- [x] 7c. **C — 发起挑战+开局**：点击对手角色 → game:challenge → 双方进入对战界面
- [x] 7d. **D — 出拳+判定+赛果**：GameBoard 出拳 + MatchResult 弹窗，完整走完三局两胜
- [x] 7e. **E — 后台监控**：Admin 展示房间列表 + 对局历史（轮询 /api/admin/status）
- [x] 7f. **F — 重赛+认输+断线**：流程闭环，各边界状态处理
- [x] 7g. **G — 机器人对战**：新增常驻机器人角色，纯随机出牌，支持挑战/结算/重赛

**第五阶段：音效与动画**
- [x] 8a. **UI 交互音效**：角色选中/取消、挑战冲锋号、出拳 punch、翻骰节拍（Web Audio API 合成）
- [x] 8b. **出拳翻骰动画**：choosing 阶段独立滚筒区域快速轮换 ✊✋✌️，点击定格 + punch 音效
- [x] 8c. **Ready Go 动画**：比赛首局 3 秒倒计时动效，READY→GO! 弹缩入场 + 遮罩渐隐
- [x] 8d. **背景音乐系统**：大厅/对战/结算三阶段 BGM 自动切换，`roomState.game.status` 驱动
