# v3.6 Phase 1 E2E 基线报告

## 1. 范围与结论

2026-07-30 连续执行 `@stable` 基线 3 次，共运行 33 个浏览器场景，33 个通过、0 个失败、0 个跳过，通过率 100%。三次均由 Playwright 独立启动和关闭 client/server，未发现随机失败、测试顺序依赖或跨运行房间残留。

Phase 1 已达到 E2E 基线完成条件。`@lifecycle-issue` 不纳入本次稳定性统计，其中两个已知问题继续作为 Phase 2 输入。

## 2. 覆盖矩阵

| Spec / 行号 | 场景 | Tag | 三次结果 |
|---|---|---|---|
| `arithmetic-game.spec.js:18` | 算术完整比赛 | `@stable` | 3/3 通过 |
| `room-leave.spec.js:6` | 非最后玩家主动退出 | `@stable` | 3/3 通过 |
| `room-leave.spec.js:33` | 最后玩家退出后干净重入 | `@stable` | 3/3 通过 |
| `room.spec.js:11` | 房间、角色、模式与难度同步 | `@stable` | 3/3 通过 |
| `rps-forfeit.spec.js:5` | RPS 认输后恢复房间 | `@stable` | 3/3 通过 |
| `rps-game.spec.js:27` | RPS 双人完整比赛 | `@stable` | 3/3 通过 |
| `rps-rematch.spec.js:43` | RPS 赛后返回房间 | `@stable` | 3/3 通过 |
| `rps-rematch.spec.js:63` | RPS 重赛状态重置 | `@stable` | 3/3 通过 |
| `rps-vs-robot.spec.js:25` | RPS 人机完整比赛 | `@stable` | 3/3 通过 |
| `spelling-game.spec.js:13` | 默写核心交互 | `@stable` | 3/3 通过 |
| `spelling-game.spec.js:74` | 默写完整比赛与赛果 | `@stable` | 3/3 通过 |
| `lifecycle/non-participant-forfeit.spec.js:3` | LIFE-002 非参赛者认输权限 | `@lifecycle-issue` | 已知问题，预期失败 |
| `lifecycle/quiz-player-leave.spec.js:7` | LIFE-001 答题比赛中离开 | `@lifecycle-issue` | 已知问题，预期失败 |
| `lifecycle/rps-disconnect-reconnect.spec.js:5` | RPS 断线取消与自动重入 | `@lifecycle-issue` | 当前行为通过 |

## 3. 运行环境

| 项目 | 值 |
|---|---|
| 操作系统 | macOS Darwin 25.5.0 arm64 |
| Node.js | v24.2.0 |
| Playwright | 1.62.0 |
| Chromium | Chrome for Testing 151.0.7922.34（Playwright Chromium revision 1234） |
| Browser Project | `chromium`，headless，单 worker |
| Base URL | `http://localhost:3000/family-war/` |
| 服务启动 | `client/playwright.config.js` `webServer` 自动启动 client/server |
| Server | `http://localhost:4000` |
| 快速 Profile | `E2E_FAST=1`，仅测试服务进程生效 |
| 执行命令 | `npm run test:e2e:stable --prefix client -- --reporter=list,json` |

> 历史基线执行时通过 CLI 启用 JSON Reporter；Phase 1 审核收尾后已将 JSON Reporter 固化到 `client/playwright.config.js`，常规 E2E 命令会自动输出 `tests/e2e/test-results/e2e-results.json`。revision 1234 来自 Playwright 1.62.0 的 `browsers.json`，不是占位值。

## 4. 连续运行结果

| 次数 | 开始时间（Asia/Shanghai） | 通过 | 失败 | 跳过 | 通过率 | 总耗时 | 失败场景 |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | 2026-07-30 19:59:59 | 11 | 0 | 0 | 100% | 129.651s | 无 |
| 2 | 2026-07-30 20:02:18 | 11 | 0 | 0 | 100% | 125.662s | 无 |
| 3 | 2026-07-30 20:04:33 | 11 | 0 | 0 | 100% | 126.437s | 无 |
| 合计 | — | 33 | 0 | 0 | 100% | 381.750s | 无 |

33 次场景执行耗时统计：

- p50：12.201s
- p95：23.391s
- 最短：2.195s
- 最长：23.614s

## 5. 诊断结果

三次运行均无失败，因此没有生成失败截图、Trace 或失败诊断附件。运行输出未发现 `pageerror`、关键 `console.error`、请求失败或非预期 Socket.IO 断连。每个 fixture 在场景结束后关闭独立 Browser Context，服务端日志显示真人玩家连接均已释放。

Playwright 运行时存在 `NO_COLOR` 被 `FORCE_COLOR` 覆盖的 Node 警告，属于终端颜色环境提示，不影响测试结果或业务行为。

## 6. 生命周期问题清单

| 问题 | 当前现象 | 目标行为 | 严重级别 | 后续归属 |
|---|---|---|---|---|
| LIFE-001 | 算术/默写参赛者退出后，其他玩家仍停留在旧对局 | 清理游戏和机器人定时器，通知其他参赛者返回房间 | P1 | Phase 2 房间与对局生命周期 |
| LIFE-002 | RPS 非参赛者可发送认输并清理他人对局 | 拒绝非参赛者操作，原对局保持可交互 | P1 | Phase 2 对局权限 |

完整复现步骤和目标断言见 `docs/acceptance/v3.6/lifecycle-issues.md`。

## 7. 下一阶段输入

1. 统一治理 RPS、算术、默写的参赛者离开和断线清理语义，优先修复 LIFE-001。
2. 为认输、重赛、输入等游戏事件增加统一参赛者权限校验，修复 LIFE-002。
3. LIFE-001 修复后删除 `test.fail()` 并转入浏览器 `@stable`；LIFE-002 修复后迁入服务端真实 Socket.IO 集成测试，删除无 UI 的 Playwright 问题 spec。
4. 后续服务端“房间与对局生命周期”优化必须运行 11 个 `@stable` 场景回归。

## 8. Phase 1 审核收尾

2026-07-31 针对 1n–1s 完成二次审核和收尾：

- 明确 Node Socket 只是无 UI 权限缺陷的 `@lifecycle-issue` 例外，不得进入 `@stable` 或替代浏览器主链路；
- LIFE-002 的 Node Socket fixture 已统一连接清理，并在失败结果中附加脱敏的连接、`connect_error` 和 `disconnect` 诊断；
- 挑战等待、角色放弃和无角色提示已改为明确目标或稳定 testid，RPS 认输、重赛和断线场景共用同一开局 helper；
- JSON Reporter 已固化到 Playwright 配置，输出目录已由 `.gitignore` 排除；
- 收尾后客户端 87 个单测全部通过，11 个 `@stable` 全部通过，3 个 `@lifecycle-issue` 按预期通过，未分类用例为 0。

Phase 1 验收结论保持“通过”，本次收尾未修改游戏业务或 Socket.IO 协议。
