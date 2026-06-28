# Family War 🎮

一个线上石头剪刀布游戏系统，支持多人在线对战。

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
│   │   └── index.html
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── Home.test.js                   # 首页 TDD 测试 (6 个)
│   │   │   ├── Room.test.js                   # 房间页 TDD 测试 (8 个)
│   │   │   ├── RoleCard.test.js               # 角色卡片 TDD 测试 (7 个)
│   │   │   └── Admin.test.js                  # 后台页 TDD 测试 (1 个)
│   │   ├── pages/
│   │   │   ├── Home.js                        # 首页：输入昵称进入房间
│   │   │   ├── Room.js                        # 房间页：选角色、挑战、对战
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
│   │   ├── setupTests.js                      # Jest 全局配置 + 抑制 React Router 警告
│   │   ├── App.js
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

## 游戏流程

```
首页 (输入昵称) → 进入房间 → 选择角色(自动ready) → 点击对手角色 → 开始对战 → 猜拳 → 结算
```

| 步骤 | 行为 | 通讯 |
|------|------|------|
| 进入房间 | 输入昵称，加入默认房间 | `socket.emit('room:join', { nickname })` |
| 选角色 | 点击 爸爸/妈妈/儿子（已有人用的角色禁用） | `socket.emit('role:select', { role })` |
| 发起挑战 | 点击对手角色卡片 | `socket.emit('game:challenge', { targetId })` |
| 双方出拳 | 各选 石头/剪刀/布 | `socket.emit('game:move', { choice })` |
| 判定结果 | 服务器比对，广播本局结果 | 客户端收到 `game:roundResult` |
| 赛果 | 先赢 2 局者胜 | 客户端收到 `game:matchResult` |

## 游戏规则

| 规则 | 内容 |
|------|------|
| 赛制 | 三局两胜（先赢 2 局者获胜） |
| 挑战 | 点击对手角色 → 直接开始，无确认弹窗 |
| 平局 | 该局无效，双方不得分，继续下一局直到出现赢家 |
| 断线 | 立即结束比赛，整场比赛结果无效，双方回到房间空闲状态 |
| 记分 | 不计分，纯判定胜负 |
| 房间 | 默认 `default`，后期支持多房间（设计预留 roomId） |
| 角色 | 爸爸/妈妈/儿子，一人一角色，选了自动 ready |
| 旁观 | 暂不支持 |

## Socket 事件清单

| 方向 | 事件 | 数据 | 说明 |
|------|------|------|------|
| C→S | `room:join` | `{ nickname }` | 加入默认房间 |
| C→S | `room:leave` | — | 离开 |
| C→S | `role:select` | `{ role }` | 选角色（爸爸/妈妈/儿子） |
| C→S | `role:deselect` | — | 放弃当前角色 |
| C→S | `game:challenge` | `{ targetId }` | 点击对手发起挑战 |
| C→S | `game:move` | `{ choice }` | 出拳（rock/paper/scissors） |
| C→S | `game:rematch` | — | 再来一局 |
| C→S | `game:forfeit` | — | 认输回房 |
| S→C | `room:state` | 完整房间 | 每次状态变更推送 |
| S→C | `game:start` | `{ opponent, round }` | 开局 |
| S→C | `game:roundStart` | `{ round }` | 新一轮开始 |
| S→C | `game:roundResult` | `{ winner, yourMove, oppMove, scores }` | 本局结果 |
| S→C | `game:matchResult` | `{ winner }` | 赛果 |
| S→C | `game:error` | `{ message }` | 错误提示 |
| S→C | `player:joined` | `{ player }` | 有人进房 |
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
| Home 渲染 | client Home | 前端单元 | 3 |
| Home 进入游戏 | client Home | 前端单元 | 3 |
| Room 渲染 + 交互 | client Room | 前端单元 | 8 |
| RoleCard 渲染 + 交互 | client RoleCard | 前端单元 | 7 |
| Admin 渲染 | client Admin | 前端单元 | 1 |
| **总计** | | | **68** |

## 端口

| 服务 | 端口 |
|------|------|
| client (React) | 3000 |
| server (Koa) | 4000 |

- **server**: 4000（Koa + Socket.IO）
- **client**: 3000（React 开发服务器）
- 开发环境下 socket.io 客户端直连 `http://localhost:4000`（CORS 已配置）
- `/api` 请求通过 CRA 代理 (`setupProxy.js`) 转发到 4000

## 前端安全保护

- **Room 页自动跳转**：直接访问 `/room`（未通过 Home 进入）时，3 秒后自动跳回首页
- **Home → Room 状态传递**：Home 收到 `room:state` 后通过路由 state 传给 Room，Room 以此判断是否来自正常流程

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
- [x] 7a. **A — 进入游戏**：Home 输入昵称 → emit room:join → 收到 room:state 跳转 /room
- [x] 7b. **B — 角色选择**：Room + RoleCard 展示三角色，选/弃角色，实时同步
- [ ] 7c. **C — 发起挑战+开局**：点击对手角色 → game:challenge → 双方进入对战界面
- [ ] 7d. **D — 出拳+判定+赛果**：GameBoard 出拳 + MatchResult 弹窗，完整走完三局两胜
- [ ] 7e. **E — 后台监控**：Admin 展示房间列表 + 对局历史（轮询 /api/admin/status）
- [ ] 7f. **F — 重赛+认输+断线**：流程闭环，各边界状态处理
