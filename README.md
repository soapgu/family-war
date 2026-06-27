# Family War 🎮

一个线上石头剪刀布游戏系统，支持多人在线对战。

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | React + react-app-rewired + JS |
| 后端 | Koa + @koa/router + JS |
| 实时通信 | Socket.IO |
| 管理接口 | Koa REST 路由 |
| 数据库 | 无（纯内存） |

## 目录结构

```
family-war/
├── client/                         # React 前端 (端口 3000)
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.js             # 首页：输入昵称进入房间
│   │   │   ├── Room.js             # 房间页：选角色、挑战、对战
│   │   │   └── Admin.js            # 后台：房间状态 + 对局记录
│   │   ├── components/
│   │   │   ├── RoleCard.js         # 角色卡片（空闲/选中/对战中）
│   │   │   ├── GameBoard.js        # 对战面板（石头剪刀布按钮）
│   │   │   └── MatchResult.js      # 结算弹窗
│   │   ├── hooks/
│   │   │   └── useSocket.js        # Socket.IO 封装
│   │   ├── App.js
│   │   └── index.js
│   ├── config-overrides.js
│   └── package.json
├── server/                         # Koa 后端 (端口 4000)
│   ├── __tests__/
│   │   └── roomManager.test.js     # roomManager 单元测试（Jest）
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
| 框架 | Jest v29（server 目录下零配置） |
| 文件 | `server/__tests__/roomManager.test.js`、`server/__tests__/gameManager.test.js` |
| 类型 | `@types/jest` + `jsconfig.json` 提供 VSCode 智能提示 |

### 运行测试

```bash
# 根目录运行（推荐）
npm test

# server 目录运行
npm test --prefix server

# watch 模式
npm test:watch --prefix server
```

### 测试覆盖

| 分组 | 模块 | 用例数 |
|------|------|--------|
| joinRoom / leaveRoom | roomManager | 5 |
| selectRole / deselectRole | roomManager | 7 |
| handleDisconnect | roomManager | 3 |
| getRoomState | roomManager | 2 |
| broadcastRoomState | roomManager | 2 |
| getAdminStatus | roomManager | 2 |
| setGame / clearGame | roomManager | 3 |
| createGame | gameManager | 1 |
| submitMove | gameManager | 11 |
| handleDisconnect | gameManager | 4 |
| getGame | gameManager | 3 |
| **总计** | | **43** |

## 端口

| 服务 | 端口 |
|------|------|
| client (React) | 3000 |
| server (Koa) | 4000 |

client 通过 `config-overrides.js` 代理 `/api` 和 socket 请求到 4000。

## 实现步骤

- [x] 1. 初始化项目结构：client（CRA+rewired）、server（Koa+socket.io）、根 package.json
- [x] 2. roomManager.js — 房间 CRUD、角色分配、在线状态管理（含 24 个单元测试）
- [x] 3. gameManager.js — 猜拳判定、三局两胜赛制、平局重赛、断线结束比赛（含 19 个单元测试）
- [ ] 4. handler.js — 注册所有 socket 事件
- [ ] 5. admin.js — GET /api/admin/status 管理接口
- [ ] 6. Client 页面：Home.js、Room.js、Admin.js + react-router 路由
- [ ] 7. Client 组件：RoleCard.js、GameBoard.js、MatchResult.js + 动画
