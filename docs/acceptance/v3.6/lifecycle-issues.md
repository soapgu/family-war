# v3.6 Phase 2 生命周期问题关闭记录

## 结论

Phase 2 已关闭 LIFE-001、LIFE-002 两个 P1 问题。LIFE-001 的浏览器最小复现已移除 `test.fail()` 并转为 `@stable`；LIFE-002 的协议级 Playwright spec 已删除，回归迁入 `server/tests/integration.js`。RPS 断线重连行为继续作为 `@lifecycle-issue` 专项场景保留。

## 问题清单

| 编号 | 场景 | 原现象 | 关闭阶段 | 状态 |
|------|------|--------|----------|------|
| LIFE-001 | 算术或默写参赛者在比赛中主动退出 | 退出者离房，但答题类游戏未取消，其他参赛者仍停留在引用旧阵容的游戏面板 | 2d、2j | ✅ 已关闭 |
| LIFE-002 | RPS 非参赛者发送认输 | 服务端未校验发起者，旁观者可清理 A/B 的对局 | 2e、2j | ✅ 已关闭 |

## LIFE-001 关闭记录

### 原现象
算术或默写参赛者在比赛中主动退出后，旧对局未取消、机器人定时器未清理，剩余玩家仍停留在引用旧阵容的游戏面板无法回到房间。

### 修复方式（提交 `3bdb1f2`）
- `cancelGameIfActive` 删除 `arithmetic`/`spelling` 类型拦截，统一走 `lifecycle.cleanupGame` 入口
- 三模式参赛者离开/断线均取消整场 + 清机器人调度 + 通知所有仍在线真人参赛者

### 关闭条件达成
1. ✅ Handler 单测覆盖算术、默写的主动离开和断线，以及旁观者离开不取消对局（`handler.test.js`）
2. ✅ 真实 Socket.IO 集成测试验证旧对局和机器人调度不再推进，剩余参赛者只收到一次取消（`integration.js` section 10）
3. ✅ 浏览器最小复现移除 `test.fail()` 并转为 `@stable`（`quiz-player-leave.spec.js`），用户可返回房间再次开始比赛

## LIFE-002 关闭记录

### 原现象
RPS 非参赛者（旁观者）发送 `game:forfeit` 可清除 A/B 的对局，服务端未校验发起者。

### 修复方式（提交 `bdc3f27`）
- `game:forfeit` 新增 `game.players.includes(socket.id)` 参赛者校验
- 非参赛者收到 `你不是本局玩家`，原对局不变
- 合法认输迁移到 `lifecycle.cleanupGame` 入口

### 关闭条件达成
1. ✅ Handler 单测覆盖非参赛者、参赛者、无对局和终局四种认输权限（`handler.test.js`）
2. ✅ 真实 Socket.IO 集成测试验证旁观者只收到一次权限错误，A/B 可以继续当前轮并正常完成对局（`integration.js` section 11）
3. ✅ 删除 Playwright 协议级问题 spec（`non-participant-forfeit.spec.js` + `socketClient.js`），由服务端集成测试长期回归

## 已冻结行为

`lifecycle/rps-disconnect-reconnect.spec.js` 冻结以下当前正确行为，继续保留 `@lifecycle-issue` Tag：

- RPS 参赛者断线后比赛取消，另一方退出游戏面板；
- 断线者从在线玩家列表移除并释放角色，在线玩家原角色保留；
- 网络恢复后客户端以原昵称自动重入房间，但不恢复原角色或已取消对局。

## 不重复建立 E2E 的行为

- 重复答案：RPS、算术已有服务端单测，客户端提交态会禁用操作控件。
- 过期题目：算术和默写 GameMode 已有 `questionId` 拒绝单测。
- 快速重复操作：Phase 2 已由 `handler.test.js` 幂等与竞态基线 + `integration.js` section 13 覆盖。
