# v3.6 Phase 2 报告：服务端房间与对局生命周期治理

## 1. 范围与结论

Phase 2 覆盖步骤 2a–2j，全部完成。

| 步骤 | 内容 | 状态 |
|------|------|------|
| 2a | 冻结生命周期状态与权限矩阵 | ✅ |
| 2b | 建立服务端生命周期测试基线 | ✅ |
| 2c | 统一对局清理入口（带 gameId 防护） | ✅ |
| 2d | 修复 LIFE-001（参赛者离开/断线取消整场） | ✅ |
| 2e | 修复 LIFE-002（认输校验参赛者） | ✅ |
| 2f | 收敛所有游戏事件权限与错误文案 | ✅ |
| 2g | 治理终局与重赛 | ✅ |
| 2h | 补齐幂等和竞态基线 | ✅ |
| 2i | 增加生命周期诊断日志 | ✅ |
| 2j | 回归并关闭问题 | ✅ |

**结论**：Phase 2 完成条件 11 条全部满足（见第 7 节逐条对照）。LIFE-001、LIFE-002 已关闭。无未通过项。

## 2. 规则实现映射

状态/权限矩阵规则（`lifecycle-design.md` §5）与实现、测试的映射：

| 规则 | Handler 实现 | 单元测试 | 集成测试 | E2E |
|------|-------------|----------|----------|-----|
| 等待中挑战 | `handler.js:game:challenge` | `handler.test.js` 合法挑战 | `integration.js` section 3 | `@stable` RPS/算术/默写完整比赛 |
| 进行中挑战独占 | `handler.js:game:challenge` 状态校验 | `handler.test.js` 进行中再挑战被独占拒绝 | — | — |
| 进行中输入授权 | `handleGameInput` status+参与者校验 | `handler.test.js` 2f 旁观者出拳/答题被拒 | — | — |
| 进行中认输 | `game:forfeit` 参赛者校验 + cleanupGame | `handler.test.js` 认输四场景 | `integration.js` section 11 | — |
| 参赛者离开/断线取消 | `cancelGameIfActive` + cleanupGame | `handler.test.js` 三模式离开/断线 | `integration.js` section 10 | `quiz-player-leave.spec.js` @stable |
| 旁观者离开不影响对局 | `cancelGameIfActive` 旁观者守卫 | `handler.test.js` 旁观者离开/断线 | — | — |
| 终局参赛者离开清理 | `cancelGameIfActive` match_end 分支 | `handler.test.js` 终局离开 | `integration.js` section 12 | — |
| 终局重赛授权 | `game:rematch` 参赛者+在线校验 | `handler.test.js` 重赛三场景 | `integration.js` section 12 | — |
| 统一清理 gameId 防护 | `lifecycle.js:cleanupGame` | `lifecycle.test.js` gameId 防护 5 用例 | — | — |
| 幂等与竞态 | handler + lifecycle + GameMode | `handler.test.js` 幂等与竞态块 | `integration.js` section 13 | — |
| 诊断日志 | `emitError` + `[cleanup]` + 增强 `[challenge]/[rematch]/[cancel]/[forfeit]` | `handler.test.js` 2i 日志块 + `lifecycle.test.js` 日志块 | — | — |

## 3. 问题关闭记录

### LIFE-001：算术/默写参赛者离开不取消对局

- **原现象**：参赛者离开后旧对局未取消，剩余玩家停留在旧面板
- **修复方式**：`cancelGameIfActive` 删除类型拦截，统一走 `lifecycle.cleanupGame`（提交 `3bdb1f2`）
- **目标断言**：三模式参赛者离开取消整场 + 清调度 + 通知所有在线真人
- **Tag 迁移**：`quiz-player-leave.spec.js` 移除 `test.fail()`，`@lifecycle-issue` → `@stable`

### LIFE-002：RPS 非参赛者认输可清他人对局

- **原现象**：旁观者发 `game:forfeit` 清除 A/B 对局，无权限错误
- **修复方式**：`game:forfeit` 加参赛者校验 + 迁移 cleanupGame（提交 `bdc3f27`）
- **目标断言**：非参赛者收 `你不是本局玩家`，原对局不变
- **Tag 迁移**：`non-participant-forfeit.spec.js` + `socketClient.js` 删除，回归迁入 `integration.js` section 11

### RPS 断线重连（冻结行为，未关闭）

- `rps-disconnect-reconnect.spec.js` 保留 `@lifecycle-issue`，冻结当前正确行为

## 4. 测试结果

验收命令执行环境：macOS darwin 25.5.0 arm64，Node.js v24.18.0。

| 命令 | 结果 | 耗时 |
|------|------|------|
| `npm test --prefix server` | 12 suites, 342 passed | 1.9s |
| `npm run test:integration` | 109 passed, 0 failed | ~15s |
| `npm test --prefix client` | 10 files, 87 passed | ~3s |
| `npm run test:e2e:stable --prefix client` | 12 passed | 2.2m |
| `npm run test:e2e:lifecycle --prefix client` | 1 passed | 49.5s |
| `npm run test:e2e:check:untagged --prefix client` | 0 tests（无漏网） | <1s |
| `git diff --check` | OK（exit 0） | <1s |

失败清单：无。

## 5. 诊断结果

- **残留房间/对局**：无。集成测试 section 10 末尾验证重新加入房间无游戏残留；section 12 终局离开后 `room.game` 清为 null。
- **残留真人 Socket**：无。所有集成测试段末尾关闭 Socket（s1/s2/s3/s4/s5.close()）。
- **机器人调度残留**：无。`lifecycle.cleanupGame` 同步调用 `robotScheduler.clear(roomId)`；`robotScheduler.test.js` 验证 clear 幂等 + 旧任务不推进新对局。
- **重复通知**：无。幂等与竞态基线（`handler.test.js` + `integration.js` section 13）验证重复认输/重复离开不重复通知。
- **关键日志**：5 类事件均有 7 稳定字段日志（事件/roomId/gameId/游戏类型/操作者/结果/原因），`[answer]` 不记录正确答案明文（脱敏合规）。

## 6. 兼容性说明

### Socket.IO 事件与 Payload 兼容性

- **保持兼容**：`game:cancelled`、`game:forfeited`、`game:error`、`game:start` 等事件与 Payload 结构不变。取消消息继续使用 `{ message }`。
- **新增内部模块**：`lifecycle.js`（Lifecycle class）为服务端内部模块，不暴露新 Socket 事件。
- **错误文案变化**：部分 `game:error` 文案收敛为冻结文案（如 `你不在这个房间中`、`没有进行中的比赛`），客户端纯透传显示，无硬编码比对。

### 存在但推迟处理的行为

- **RPS 断线重连**：保留 `@lifecycle-issue`，不恢复原对局/角色（设计冻结）。
- **robotScheduler gameId 绑定**：当前 `robotScheduler.clear` 按 roomId，gameId 级防护由 `lifecycle.cleanupGame` 入口层覆盖；调度器内部 gameId 绑定未实现（QuizGameMode 层有 questionId 过期防护兜底）。
- **答题模式"再来一局"**：继续通过 `game:challenge` 发起，不用 `game:rematch`。

## 7. 下一阶段输入

Phase 2 完成条件（`step.md:1565-1577`）逐条对照：

| # | 完成条件 | 达成 |
|---|----------|------|
| 1 | 生命周期状态与权限矩阵有明确实现和自动化测试映射 | ✅ |
| 2 | LIFE-001、LIFE-002 目标断言正常通过，不再用 `test.fail()` | ✅ |
| 3 | LIFE-001 转 `@stable`，LIFE-002 迁入服务端集成测试，RPS 断线重连保留 `@lifecycle-issue` | ✅ |
| 4 | 三模式真人参赛者进行中离开/断线后旧对局和机器人调度清除，剩余真人收到一次取消通知 | ✅ |
| 5 | 旁观者离开/断线/认输/提交输入不能改变他人对局 | ✅ |
| 6 | 终局参赛者离开后不能通过过期 Socket 重赛，合法重赛从全新状态开始 | ✅ |
| 7 | 重复或过期操作不重复通知/计分/结算/清除新局/遗留机器人任务 | ✅ |
| 8 | 生命周期日志能定位房间/游戏类型/事件/操作者/原因，不含敏感数据 | ✅ |
| 9 | 服务端单测、集成、客户端单测、稳定 E2E、生命周期 E2E 全部达预期 | ✅ |
| 10 | fixture 和 Socket 清理后无残留真人玩家/房间对局/机器人调度 | ✅ |
| 11 | 形成 `phase-2-report.md` | ✅ |

### 全量回归与版本发布待验证项

- **全量回归**：Phase 2 验收命令已全部通过，但尚未执行跨 Phase 1 的全量回归（`npm run build:verify`、admin 单测/acceptance 等）。
- **版本发布**：v3.6 尚未发布。发布前需补充 `docs/RELEASE.md` 的版本记录，并执行 `gh release create`。
- **road-map.md**：v3.6 状态需从"规划中"更正为"已完成"。
