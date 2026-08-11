# v3.7.0 验证记录

> 本文件记录 v3.7.0「基础依赖现代化」升级前的 v3.6 基线冻结结果，作为 Ant Design 6 与 Jest 30 升级前后对照依据。
>
> 生成日期：2026-08-11
>
> 对应实施计划：`step.md` Phase 0（0a–0e）

## 环境约束说明

- Supertest/Koa 接口测试需本地端口监听；受限沙箱中的 `listen EPERM` 属实施环境限制，不计为 Jest 30 或服务端行为回归。
- E2E 实跑与视觉截图需 `npm run dev` 提供 server:4000 / client:3000 / admin:3001。
- Socket.IO 集成测试需 4001 端口空闲，且服务端未占用该端口。
- 视觉基线仅桌面宽度，不含手机/平板/窄屏（与 v3.7 非目标一致）。

## 0a 环境与版本基线

### 运行时

| 项 | 版本 |
|---|---|
| Node.js | v24.18.0 |
| npm | 11.16.0 |
| 工作区 | main 分支，干净（v3.7 规划文档修改已处理） |

### 游戏端 client（package.json 声明 -> lockfile 解析）

| 依赖 | package.json | lockfile 解析 | 备注 |
|---|---|---|---|
| react | ^19.2.7 | 19.2.7 | 与 admin-client 不一致 |
| react-dom | ^19.2.7 | 19.2.7 | 与 admin-client 不一致 |
| antd | ^5.29.3 | 5.29.3 | 两端一致 |
| @ant-design/icons | （未声明） | 5.6.1 | 源码 SpellingBoard.jsx 显式 import，package.json 缺直接声明 |
| socket.io-client | ^4.8.3 | 4.8.3 | |
| vite | ^6.3.0 | 6.4.3 | devDep |
| vitest | ^3.1.0 | 3.2.7 | devDep |
| @vitejs/plugin-react | ^4.4.2 | 4.7.0 | devDep |

### 管理端 admin-client

| 依赖 | package.json | lockfile 解析 | 备注 |
|---|---|---|---|
| react | ^19.2.7 | 19.2.8 | 与 client 不一致 |
| react-dom | ^19.2.7 | 19.2.8 | 与 client 不一致 |
| antd | ^5.29.3 | 5.29.3 | 两端一致 |
| @ant-design/icons | ^5.6.1 | 5.6.1 | 显式声明 |
| react-router-dom | ^6.30.4 | 6.30.4 | |
| vite | ^6.3.0 | 6.4.3 | devDep |
| vitest | ^3.1.0 | 3.2.7 | devDep |
| @vitejs/plugin-react | ^4.4.2 | 4.7.0 | devDep |

### 服务端 server

| 依赖 | package.json | lockfile 解析 | 备注 |
|---|---|---|---|
| jest | ^29.7.0 | 29.7.0 | devDep，待升 30.x |
| @types/jest | ^30.0.0 | 30.0.0 | devDep，与 jest 主版本错位 |
| koa | ^2.15.3 | 2.16.4 | |
| @koa/router | ^12.0.1 | 12.0.2 | |
| socket.io | ^4.7.5 | 4.8.3 | |
| socket.io-client | ^4.8.3 | 4.8.3 | devDep |
| supertest | ^7.2.2 | 7.2.2 | devDep |
| jsonwebtoken | ^9.0.3 | 9.0.3 | |
| winston | ^3.19.0 | 3.19.0 | |
| unsplash-js | ^6.3.0 | 6.3.0 | |
| nodemon | ^3.1.4 | 3.1.14 | devDep |

### 基线确认要点

- react/react-dom：client 19.2.7、admin-client 19.2.8，两端解析不一致（v3.7 待统一）。
- @ant-design/icons：client package.json 未声明但 lockfile 已解析且源码显式使用（v3.7 待补直接声明）。
- jest 29.7.0 与 @types/jest 30.0.0 主版本错位（v3.7 待对齐）。
- 三个子包 version 字段当前均为 3.6.0。

## 0b 单元测试基线

运行时间：2026-08-11 16:34–16:35

| 子包 | 命令 | 测试文件 | 用例数 | 结果 | 耗时 | 既有警告 |
|---|---|---|---|---|---|---|
| server | `npm test --prefix server` | 12 suites | 342 | 全过 | 1.556s | 无 |
| client | `npm test --prefix client` | 10 files | 87 | 全过 | 6.88s | jsdom `window.getComputedStyle(elt, pseudoElt)` 未实现（rc-util `getScrollBarSize`，antd Portal/Modal 滚动条测量），不阻断 |
| admin-client | `npm test --prefix admin-client` | 14 files | 59 | 全过 | 9.08s | `An update to ForwardRef inside a test was not wrapped in act(...)`，不阻断 |

- 三层均达 v3.6 基线锚点（342 / 87 / 59）。
- server Supertest 在本环境正常监听，无 EPERM。
- client 的 jsdom getComputedStyle 警告与 admin-client 的 act 警告均为 v3.6 既有，升级 antd 6 后需对照是否消失或变化。

## 0c 构建与隔离基线

运行时间：2026-08-11 16:35

### 生产构建（`npm run build`，concurrently 两端）

| 端 | 构建耗时 | index.html | index.css | index.js | gzip(js) | 模块数 |
|---|---|---|---|---|---|---|
| client | 3.71s | 0.81 kB | 7.15 kB (gzip 2.04) | 817.02 kB | 258.93 kB | 3041 |
| admin-client | 3.76s | 0.65 kB | 3.80 kB (gzip 1.35) | 883.76 kB | 280.54 kB | 3021 |

- 产物目录：`client/build/`（含 public 资源共 7.4M，assets 808K）、`admin-client/build/`（880K，assets 868K）。
- 既有警告：两端均有 `Some chunks are larger than 500 kB after minification`（v3.6 既有，非本次引入）。

### 构建隔离检查（`npm run build:verify`）

- 结果：**通过**（"游戏端和管理端产物可独立、重复构建"）。
- 脚本逻辑：对两端 build 目录做 SHA256 快照，组合构建与各自单独构建对比一致。

## 0d 集成 / E2E / 验收基线

运行时间：2026-08-11 16:34–16:41

### 离线检查（无需 dev）

| 项 | 命令 | 结果 | 锚点对照 |
|---|---|---|---|
| Socket.IO 集成 | `npm run test:integration --prefix server` | 通过 109 / 失败 0 | = 109 ✅ |
| E2E 全量清单 | `test:e2e:check` | 13 tests / 10 files | = stable 12 + lifecycle 1 ✅ |
| stable 清单 | `test:e2e:check:stable` | 12 tests / 9 files | = 12 ✅ |
| lifecycle 清单 | `test:e2e:check:lifecycle` | 1 test / 1 file | = 1 ✅ |
| untagged 清单 | `test:e2e:check:untagged` | 0 tests | = 0 ✅ |
| 管理端验收离线 | `test:acceptance:check` | 通过（7 个步骤，依赖与路径可用） | ✅ |
| 网关离线 | `test:gateway:check` | 通过（polling/WebSocket 矩阵、API/认证/Socket path 正确） | ✅ |

### 实跑（playwright webServer 自管 server:4000 + client:3000，`reuseExistingServer:false`）

| 项 | 命令 | 结果 | 耗时 |
|---|---|---|---|
| 稳定 E2E | `test:e2e:stable` | **12 passed** | 2.1m |
| 生命周期专项 | `test:e2e:lifecycle` | **1 passed**（RPS 断线取消→重入无角色，已冻结行为） | 50.3s |

- 稳定 E2E 覆盖 RPS 双人/人机、算术、默写三种模式完整主链路 + 房间/角色/认输/重赛/离开交互，全部通过。
- 生命周期专项为 v3.6 已冻结问题基线，当前行为符合预期（断线取消整场、重入无角色），作为升级前后对照。
- 集成测试需 4001 端口空闲，本环境正常。
- 三层均达 v3.6 基线锚点。

## 0e 视觉基线截图清单

截取时间：2026-08-11 16:42–16:49

使用 browser-use 驱动 IAB Chromium，视口 1440×900（词库管理页为全页截图）。截图存于 `baseline-screenshots/`，作为 antd 6 升级前后视觉对照。

### 游戏端（http://localhost:3000/family-war/）

| 文件 | 页面 | 大小 | 说明 |
|---|---|---|---|
| 01-home.png | 游戏首页 | 723K | 输入昵称页，三角色介绍与进入房间入口 |
| 02-room.png | 房间页 | 128K | 进入房间后选角色，模式切换（猜拳/算术/默写）与在线玩家 |
| 03-rps-board.png | RPS 游戏面板 | 130K | 第 1 局出拳中，GO! 动画后石头/布/剪刀按钮 |
| 04-arithmetic-board.png | 算术面板 | 121K | 第 1 题答题中（47+0=?），排行榜与 18s 倒计时 |
| 05-spelling-board.png | 默写面板 | 261K | 第 1 题答题中，图片提示+填空字母格+38s 倒计时，EASY 难度 |
| 06-rps-match-result.png | RPS 赛果 Modal | 115K | 2:1 胜利赛果弹窗，含每局回顾与返回房间/再来一局 |

### 管理端（http://localhost:3001/admin/）

| 文件 | 页面 | 大小 | 说明 |
|---|---|---|---|
| 07-admin-login.png | 登录页 | 27K | 管理员登录弹窗，密码输入框 |
| 08-admin-home.png | 管理首页 | 42K | 登录后平台首页，Family War 应用卡片与进入管理入口 |
| 09-admin-word-config.png | 词库管理页 | 620K | 全页截图，3 章节 33 词全部同步，章节/单词启用开关与换图入口 |

- 共 9 张，覆盖游戏端首页/房间/三种游戏面板/赛果与管理端登录/首页/词库管理。
- 管理端登录使用 `server/config.local.js` 中配置的 adminPassword。
- 视觉基线仅桌面 1440×900 宽度，不含手机/平板/窄屏（与 v3.7 非目标一致）。
