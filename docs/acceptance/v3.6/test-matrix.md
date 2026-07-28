# v3.6 E2E 基线 — 测试矩阵

> 本文件由 step.md 1a 产出，对齐 Phase 1 测试宇宙盘点。结构：① 文件清单层（27 候选 → 21 纳入 + 6 排除）；② 行为场景层（按用户行为/协议场景组织，可多标签标注覆盖状态与处置结论）。

## 维度说明

### 当前覆盖状态（每行 1 选）

| 状态 | 含义 |
|---|---|
| 已覆盖 | 至少一个测试明确验证该行为，且断言用户可观察结果或可重现的协议结果 |
| 部分覆盖 | 仅服务端内存状态、协议细节或单一客户端视角，缺跨浏览器同步或多场景端到端验证 |
| 未覆盖 | 测试宇宙内没有任何位置验证该行为 |
| 不适用 | 行为本身不属于该测试层（已在"排除项"中说明） |

### 处置结论（允许多值）

| 处置 | 含义 |
|---|---|
| E2E 保留并重构 | 现有 E2E 覆盖但形态需按 Phase 1 约束重写 |
| E2E 待补 | 当前缺 E2E 覆盖，需要新增 spec |
| 单元/集成已覆盖，E2E 不重复 | 已被单元或集成测试充分验证，E2E 不再穷举 |
| Phase 2 生命周期治理输入 | 现有测试只是暴露问题，修复和回归保护交给后续阶段 |
| 与本阶段无关，明确排除 | 不属于游戏链路（见排除项） |

---

## 一、文件清单层

### 1.1 纳入：21 个文件

#### E2E spec（2）

| 路径 | describe | test | 职责 |
|---|---|---|---|
| `client/tests/e2e/rps-game.spec.js` | 0 | 5 | RPS 双人完整比赛（5 步拆分，`describe.serial` + 共享 `beforeAll`） |
| `client/tests/e2e/rps-vs-robot.spec.js` | 0 | 3 | RPS 人机完整比赛（盲点循环 + `Promise.race` 等待结束） |

#### E2E Page Object（3）

| 路径 | 方法数 | 职责 |
|---|---|---|
| `client/tests/e2e/pages/HomePage.js` | 4 | 首页昵称输入与进入 |
| `client/tests/e2e/pages/RoomPage.js` | 6 | 房间角色选择与挑战 |
| `client/tests/e2e/pages/GameBoardPage.js` | 4 | 猜拳游戏面板（出拳/等待赛果） |

#### 客户端单测（8）

| 路径 | describe | it | 职责 |
|---|---|---|---|
| `client/src/__tests__/App.test.jsx` | 3 | 6 | 应用根（Home/Room 切换） |
| `client/src/__tests__/Home.test.jsx` | 1 | 5 | 首页组件 |
| `client/src/__tests__/Room.test.jsx` | 2 | 17 | 房间组件（含模式选择） |
| `client/src/__tests__/RoleCard.test.jsx` | 1 | 7 | 角色卡片 |
| `client/src/__tests__/ArithmeticBoard.test.jsx` | 0 | 15 | 算术游戏面板 |
| `client/src/__tests__/ArithmeticMatchResult.test.jsx` | 0 | 9 | 算术赛果 |
| `client/src/__tests__/SpellingBoard.test.jsx` | 1 | 21 | 默写游戏面板 |
| `client/src/__tests__/SpellingMatchResult.test.jsx` | 0 | 3 | 默写赛果 |

#### 服务端集成（1）

| 路径 | 规模 | 职责 |
|---|---|---|
| `server/tests/integration.js` | ~111 场景 / 89 断言 | 真实 Socket.IO 多场景端到端 |

#### 服务端单测（7 — 游戏链路相关）

| 路径 | describe | it | 职责 |
|---|---|---|---|
| `server/__tests__/roomManager.test.js` | 9 | 39 | 房间管理（玩家/角色/对局生命周期） |
| `server/__tests__/gameManager.test.js` | 16 | 38 | 对局管理（多玩法通用） |
| `server/__tests__/handler.test.js` | 5 | 9 | Socket.IO 事件处理 |
| `server/__tests__/rpsGameMode.test.js` | 8 | 20 | RPS 玩法（判胜/计分） |
| `server/__tests__/arithmeticGameMode.test.js` | 13 | 29 | 算术玩法 |
| `server/__tests__/spellingGameMode.test.js` | 16 | 43 | 默写玩法（含发音/图片） |
| `server/__tests__/robotScheduler.test.js` | 5 | 15 | 机器人调度 |

### 1.2 排除：6 个文件

| 路径 | describe | it / 断言 | 排除原因分类 | 说明 |
|---|---|---|---|---|
| `server/__tests__/adminAuth.test.js` | 6 | 37 | 管理员认证 | 认证服务不重叠游戏链路 |
| `server/__tests__/adminAuthContract.test.js` | 1 | 5 | 管理员认证 | 认证契约不重叠游戏链路 |
| `server/__tests__/unsplashClient.test.js` | 7 | 22 | Unsplash / 词库 | 图片客户端能力，不属于房间与对局 |
| `server/__tests__/wordBank.test.js` | 1 | 3 | Unsplash / 词库 | 词库数据管理，不重叠游戏行为 |
| `server/tests/unsplash-integration.js` | — | 8 断言 | Unsplash / 词库 | Unsplash 真实集成 |
| `server/tests/gateway.js` | — | ~27 场景 / 43 断言 | 网关 / 反向代理 | 公网网关路径迁移，不验证游戏行为 |

> 默写 E2E 会验证"图片提示存在或正确降级"，但不重新纳入 Unsplash/词库测试；图片搜索、同步和词库规则仍由这些专项测试负责。

---

## 二、行为场景层

> 按 step.md v3.6 场景矩阵的 12 类领域组织。分两段：2.1 列出"待补 / 重构 / 治理输入"——E2E 缺口主体；2.2 汇总"已覆盖、E2E 不重复"——按 step.md 约束"禁止 E2E 重复穷举算法输入"，单元/集成已充分覆盖的算法/校验/拒绝路径集中列出，避免矩阵主体膨胀。
>
> 列：行为场景 / 已有测试位置 / 当前覆盖 / 处置结论（多值）/ 细化要点。生命周期行为（断线、退出、认输、重赛、重复提交、过期题目）按用户要求分别单列。参数化同类算法测试合并为一行。

### 2.1 E2E 缺口矩阵

| 行为场景 | 已有测试位置 | 当前覆盖 | 处置结论 | 细化要点 |
|---|---|---|---|---|
| **首页 · 空昵称不可进入** | `client/src/__tests__/Home.test.jsx:36` | 部分覆盖 | E2E 待补 | 真实 UI 校验反馈（按钮禁用或可见提示）|
| **首页 · 有效昵称正常进入** | `client/src/__tests__/Home.test.jsx:26`, `client/src/__tests__/App.test.jsx:56` | 部分覆盖 | E2E 待补 | 跨浏览器 `room:state` 同步 |
| **房间 · 玩家加入与离开同步** | `server/__tests__/roomManager.test.js:34-90` (`joinRoom / leaveRoom`)、`server/tests/integration.js:87-100, 411-439` | 已覆盖（服务端）| E2E 保留并重构 | 1j/1p：双人双向同步；最后一人离开后端到端验证房间删除 |
| **角色 · 选择/占用/切换/放弃** | `server/__tests__/roomManager.test.js:90-160` (`selectRole / deselectRole`)、`client/src/__tests__/Room.test.jsx:77-148`、`client/src/__tests__/RoleCard.test.jsx:6-43` | 已覆盖 | E2E 待补 | 1j 跨浏览器同步：占用冲突、切换、放弃 |
| **模式 · 猜拳/算术/默写切换** | `server/__tests__/roomManager.test.js:339-378` (`setGameMode`)、`server/tests/integration.js:174-181, 240-243` | 已覆盖 | E2E 待补 | 1j 跨浏览器模式可见 |
| **模式 · 默写难度切换** | `server/tests/integration.js:336-338, 413-414`、`client/src/__tests__/Room.test.jsx:142-156` | 部分覆盖 | E2E 待补 | 1l 难度双向同步（easy/normal/hard）|
| **猜拳 · 双人完整比赛** | `client/tests/e2e/rps-game.spec.js` | 部分覆盖 | E2E 保留并重构 | 1h：自包含 3 局决胜（爸爸胜/妈妈胜/爸爸胜），逐局验证轮次与比分；不再用 `describe.serial` 拆分共享状态步骤 |
| **猜拳 · 人机完整比赛** | `client/tests/e2e/rps-vs-robot.spec.js` | 部分覆盖 | E2E 保留并重构 | 1i：去除盲点循环；验证每轮机器人出拳 + 合法赛果；不固定随机胜负为某一方 |
| **猜拳 · 认输** | （无） | 未覆盖 | E2E 待补 | 1o：认输后对手反馈 + 双方退出游戏面板 + 房间可再次发起比赛 |
| **猜拳 · 返回房间与重赛** | `server/tests/integration.js:344-361` | 已覆盖 | E2E 待补 | 1n：双向状态收敛 + 比分从 0 重新累计 |
| **算术 · 完整比赛与排名** | `server/tests/integration.js:166-225, 378-407`、`client/src/__tests__/ArithmeticBoard.test.jsx:27-157`、`client/src/__tests__/ArithmeticMatchResult.test.jsx:43-95` | 已覆盖 | E2E 待补 | 1k：跨浏览器 + `ArithmeticBoardPage.parseAndEvaluate()` 白名单解析 + 错误/正确反馈 + 排名 + 返回房间 |
| **默写 · 难度/发音/图片/输入与错误反馈** | `server/__tests__/spellingGameMode.test.js:44-217`、`client/src/__tests__/SpellingBoard.test.jsx:85-331` | 已覆盖 | E2E 待补 | 1l：跨浏览器同步 + 图片提示存在或正确降级 + 发音按钮 + 字母逐格输入 |
| **默写 · 完整比赛与排名** | `server/tests/integration.js:228-372`、`client/src/__tests__/SpellingMatchResult.test.jsx:43-65` | 已覆盖 | E2E 待补 | 1m：完整比赛 + `E2E_FAST=1` 缩短取胜分数/题目时限/机器人延迟，仍复用正式出题/判定/计分/Socket.IO 流程 |
| **生命周期 · 玩家断线** | `server/__tests__/roomManager.test.js:161-196` (`handleDisconnect`)、`server/__tests__/handler.test.js:98-115` | 已覆盖（服务端）| E2E 待补 | 双向 `room:state` 同步 + 角色释放可见 |
| **生命周期 · 客户端断线重连（已进/未进/已退）** | `client/src/__tests__/App.test.jsx:113-160` | 已覆盖（单测）| E2E 待补 | 真实 socket 重连 + 房间自动重入/不重入行为 |
| **生命周期 · 比赛中主动认输** | `server/tests/integration.js:231` (`game:forfeit`) | 部分覆盖 | E2E 待补 | 1o：认输后对手收到明确提示 + 双方退出游戏面板 + 房间可再次发起比赛 |
| **生命周期 · 主动退出房间（无进行中比赛）** | `client/src/__tests__/Room.test.jsx:124, 132` | 已覆盖（单测）| E2E 待补 | 1p：另一浏览器看到在线人数/玩家/角色释放 + 退出者返回首页 |
| **生命周期 · 比赛中退出房间** | （无） | 未覆盖 | Phase 2 生命周期治理输入 | 1q 问题基线；当前行为不冻结；最小复现归入 `client/tests/e2e/lifecycle/` 带 `@lifecycle-issue` Tag |
| **生命周期 · 重复提交答案** | `server/__tests__/rpsGameMode.test.js:115`、`server/__tests__/arithmeticGameMode.test.js:225` | 已覆盖 | E2E 不重复 | 服务端去重（已单元验证）|
| **生命周期 · 过期题目提交** | `server/__tests__/arithmeticGameMode.test.js:234` | 已覆盖 | E2E 不重复 | 服务端拦截（已单元验证）|
| **权限 · 非参赛者操作当前对局** | （无） | 未覆盖 | Phase 2 生命周期治理输入 | 1q 问题基线；3 浏览器场景（两人对局 + 第三人旁观）|
| **幂等 · 快速重复操作** | （无） | 未覆盖 | Phase 2 生命周期治理输入 | 1q 问题基线；是否重复计分或造成状态卡死 |

### 2.2 已有覆盖 · E2E 不重复（汇总）

> 下列行为已由单元或集成测试充分覆盖，按 step.md 约束"禁止 E2E 重复穷举算法输入"，E2E 不再逐项验证。

| 行为 | 已有覆盖位置 |
|---|---|
| RPS 判胜组合与 2 胜制结束条件 | `server/__tests__/rpsGameMode.test.js:48-200`（`isValidChoice`、`submitInput`、2 胜触发 `match_result`、2-1 反转）|
| 算术表达式生成与答案校验（数字/Infinity/空值/重复/过期）| `server/__tests__/arithmeticGameMode.test.js:26-93, 169-280` |
| 算术 `answerAck`（correct/expression/yourAnswer）| `server/__tests__/arithmeticGameMode.test.js:185-193` + `server/tests/integration.js:206-212` |
| 算术 `game:rematch` 拒绝 | `server/__tests__/handler.test.js:117-129` + `server/tests/integration.js:404-407` |
| 默写词库取词、填空生成（easy/normal/hard）| `server/__tests__/spellingGameMode.test.js:44-125` |
| 默写答案校验（大小写/非字符串/空值）| `server/__tests__/spellingGameMode.test.js:127-167` + `server/__tests__/handler.test.js:167-200` |
| 默写重赛（重新读取难度与角色阵容）| `server/tests/integration.js:336-361` |
| 房间状态广播与最后一人离开房间删除 | `server/__tests__/roomManager.test.js:73-90, 284-307` + `server/tests/integration.js:411-439` |
| 离开房间后定时器清理 | `server/__tests__/handler.test.js:81-115` + `server/tests/integration.js:411-439` |
| 机器人调度生命周期（创建/加速/清除/重入）| `server/__tests__/robotScheduler.test.js:32-185` + `server/__tests__/handler.test.js:81-115` |
| 默写非字符串答案拒绝（数字/对象/null）| `server/tests/integration.js:264-280` + `server/__tests__/handler.test.js:167-200` |
| 拒绝非当前模式挑战 | `server/tests/integration.js:178-181, 363-370` |
| BGM 控制（默写进行中暂停 + 返回房间恢复）| `client/src/__tests__/App.test.jsx:67-110` + `client/src/__tests__/Room.test.jsx:185-228` |
| E2E 装配（失败截图/Trace/HTML 报告/单 worker 串行）| `client/playwright.config.js:6-21` |
| 同昵称旧 socket 清理（重连场景）| `server/__tests__/roomManager.test.js:198-250` |
| 重复模式切换 | `server/__tests__/roomManager.test.js:339-378`（`setGameMode` 多次调用）|
| 非本局玩家答题拒绝 | `server/__tests__/rpsGameMode.test.js:108-114` + `server/__tests__/arithmeticGameMode.test.js:194-202` |
| 客户端单测：应用根/Home/Room/RoleCard/三个赛果 | `client/src/__tests__/{App,Home,Room,RoleCard,ArithmeticMatchResult,SpellingMatchResult}.test.jsx` |
