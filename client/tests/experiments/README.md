# Phase 1.5 答题比赛统计实验

该目录是手动、非阻断的 Playwright 实验集，不属于常规 `@stable` 或 `@lifecycle-issue` 回归。

## 命令

```bash
# 离线收集 4 组实验
npm run test:e2e:experiment:check --prefix client

# 默认完整运行：公平竞争各 10 场 + 消极比赛各 1 场
npm run test:e2e:experiment --prefix client

# 只运行公平竞争或消极比赛
npm run test:e2e:experiment:fairness --prefix client
npm run test:e2e:experiment:passive --prefix client

# 快速验证：公平竞争每模式 1 场，消极比赛仍各 1 场
EXPERIMENT_MATCH_COUNT=1 npm run test:e2e:experiment --prefix client
```

Playwright 会自动以 `E2E_EXPERIMENT=1` 启动服务端，保持 5 分制，使用 5s 题目时限和 2.5s 机器人延迟。

## 公平原则

- A/B 使用两个独立 Browser Context 和 Socket.IO 连接。
- 双方先准备答案，再在各自页面事件循环中按同一 `targetTime` 完成最后提交。
- 算术同时点击提交；默写同时填入最后一个正确字母。
- 每场重建 Context，并交替 A/B 的爸爸、妈妈角色。
- 报告记录 `armedAt`、`targetTime`、`firedAt` 和两页面的触发偏差。
- 胜率区间只产生警告；比分、流程或双视角不一致仍使实验失败。

默写实验仅捕获用户可听的 `SpeechSynthesisUtterance.text`，不读取 Socket.IO Payload、服务端内存或隐藏应用状态。

## 产物

运行后生成：

- `client/tests/e2e/test-results/experiments/quiz-experiment-report.json`
- `client/tests/e2e/test-results/experiments/quiz-experiment-report.md`

上述自动报告位于 Git 忽略目录，每次运行会覆盖上一份。需要长期对比的批次应在运行后整理到 `docs/acceptance/v3.6/`；如果旧批次只保留了汇总，不得推断或补写已经丢失的逐场数据。当前三批公平实验的长期参考见 `docs/acceptance/v3.6/quiz-experiment-report.md`。
- Playwright JSON/HTML 报告、失败截图和 Trace

整个 `client/tests/e2e/test-results/` 目录已被 Git 忽略。
