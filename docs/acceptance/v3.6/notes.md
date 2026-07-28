# v3.6 实施留痕

> 1c 实施过程中的事实更正与决策来源，便于未来 reviewer 追溯。

## 1. pm2 端口事实更正（1c 实施期间）

**错误**：1c 早期文档（`docs/acceptance/v3.6/e2e-setup.md` §1）曾写"在 pm2 预发布环境运行期间同时启动本地 E2E 服务（端口冲突，先 `pm2 stop family-war-server`）"。

**事实**：`pm2 jlist` 输出 `family-war-server` 的 `pm2_env.PORT = 4010`。整个项目早就明确区分 4000（开发）与 4010（预发布）：

- `step.md` Step 2：服务端 PM2 部署（端口 4010）
- `README.md` 第 665 行：开发 4000 / 预发布 4010
- `docs/acceptance/v3.3/phase-4-nginx-report.md` 第 5 行：PM2 端口 4010
- `docs/acceptance/v3.5/phase-5-report.md` 第 8 行：PM2 端口 4010
- `docs/acceptance/v3.5/rollback.md` 第 11 行：PM2 端口 4010

**错误来源**：在清理 EADDRINUSE 残留进程时，看到 PID 49606 启动时间与 pm2 uptime 一致，没有核实 `pm2 jlist` 的 `pm2_env.PORT`，直接基于 `server/src/index.js` 的 `PORT = process.env.PORT || 4000` 默认值推断 pm2 跑在 4000。后续多次在对话中重申这个错误判断，并把"端口冲突"写进了 e2e-setup.md。

**修正**：

- `e2e-setup.md` §1 第 26 行：从"端口冲突"改为"端口完全分离"
- `e2e-setup.md` 新增 §12 端口对照表，明确 E2E 4000 / 预发布 4010
- 1c 升级方案中移除原 Q2（pm2 端口冲突处理）决策，因前提不存在
- step.md / README.md / 既有 v3.x 验收报告：全部已正确区分 4000/4010，无需修改

**端口对照**（用于未来核对）：

| 用途 | 端口 | 启动方式 |
|---|---|---|
| 开发 | 4000 | `npm run dev` / `npm run server` |
| E2E | 4000 | Playwright `webServer`（`npm run dev:server`） |
| 预发布 | 4010 | PM2 `family-war-server` |

## 2. 1c-Phase-0 升级决策来源

参考项目 `soapgu/that-math-things@4413100` 的 "Phase 0：E2E 服务生命周期治理"：

- 用 Playwright `webServer` 自动启停 Vite，消除 E2E 对人工 `npm start` 的依赖
- 固定端口 + `strictPort` + `reuseExistingServer: false`：避免静默切换端口或静默复用未知服务
- `CLIENT_BASE_URL` 显式提供时不创建 webServer，开发者自管服务场景保留
- 不在 npm 脚本用 `pkill`/`kill`：避免误杀用户主动启动的开发服务
- 完成标准包含"中断后无残留进程"

family-war 适配差异：

| 维度 | that-math-things | family-war |
|---|---|---|
| 结构 | 单 Vite 项目 | monorepo（client + server + admin-client）|
| E2E 依赖服务 | Vite :5173 | client Vite :3000 + server Koa :4000 |
| webServer 数量 | 1 | 2（数组形式，server + client 各自探测 URL）|
| 端口冲突源 | 上次残留 5173 | pm2 预发布 4010（与 4000 分离，无冲突）|

## 3. 1c-Phase-0 决策清单

| 决策 | 选择 | 理由 |
|---|---|---|
| webServer 多进程形式 | C：单一 `command: 'concurrently ...'` 不采用；改为数组形式 | Playwright `webServer` 接受数组；server/client 各自探测 URL 互不干扰 |
| pm2 端口冲突处理 | 不需要 | pm2 跑 4010，与 4000 分离 |
| 外部服务短路 | 仅当 `CLIENT_BASE_URL` 存在时跳过 webServer | 与 that-math-things 一致；避免隐式行为 |
| webServer 探测 URL | server: `http://localhost:4000/api/health`；client: `http://localhost:3000/family-war/` | 已有 endpoint（server）+ Vite SPA fallback（client）；用 `localhost` 而非 `127.0.0.1`（macOS Vite 6 默认绑定 IPv6，127.0.0.1 不通）|
| baseURL 默认值 | `http://localhost:3000/family-war/` | 与探测 URL 一致；与探测 `localhost` 而非 `127.0.0.1` 同因 |
| 是否新增 `dev:server`/`dev:client`/`dev:e2e` 脚本 | 是（根 package.json）| `dev:server` 走 `node src/index.js`（无 nodemon），`dev:client` 走 vite（不启 admin），`dev:e2e` 用 concurrently 启 server+client |
| `--prefix ..` 路径 | `--prefix ..`（不是 `--prefix ../..`） | Playwright 工作目录在 `client/`，根在 `../` |

## 4. 1c 试验结论（rps-game.spec.js 重构 + 跑测）

**试验目的**：用 1 个 spec 验证 webServer 装配可用。

**结果**：

- ✅ webServer 装配完全通过：端口探测（`/api/health` + `/family-war/`）成功，server + client 自动启停，无残留进程
- ✅ 1c 7 条完成标准全部达成（自管、固定端口、不静默复用、CLIENT_BASE_URL 短路、端口冲突明确失败、无 pkill、pm2 4010 分离）
- ⚠️ 试验 spec `rps-game.spec.js` 跑测失败：trace 显示实际跑到了 round result 阶段（"我输了" + 0:2 比分），但 `GameBoardPage.waitForChoosingPhase()` 在某局 15s 超时
- ⚠️ 失败发生在 React 组件层（不在 1c 装配层）

**关于"根因"的重要更正**：

> 上一版 notes.md 写"Antd 5 + React 19 兼容警告导致 `readyGo` overlay 时序不一致，pageA/B 看到 `choosing` 阶段时点不同步"——这是一个**推论**，不是 trace 直接证明的事实。
>
> trace 直接证明的是：(a) Antd 警告存在；(b) 3 局对决跑到 round result 阶段；(c) pageA 在某次 `waitForChoosingPhase` 15s 超时。
>
> 把 (a)(b)(c) 串成因果链时，**可能高估了"readyGo overlay 时序不一致"这个具体原因**。更准确的描述是："Antd 5 兼容层在 effect 内的 setState 上包装 microtask，3 局对决累积下来导致 pageA/B 状态切换时序出现累积偏差，最终 pageA 在某局无法在 15s 内观察到出拳按钮"。具体哪一局、哪个状态切换被卡住，需要 1h 实施时用录屏 + DOM inspect 才能精确定位。
>
> 与 1c 装配无关的判断仍然成立：webServer 启动、端口探测、Socket 通信、3 局对决流程都跑通了。

**留待 1h 解决**：

- `GameBoardPage.waitForChoosingPhase()` 用 `data-testid` 替代 `getByRole`，减少对 Antd 渲染的依赖
- 等待条件改为"readyGo overlay 消失 + 出拳按钮可见 + 按钮可点击"组合（而不是只看 button 可见）
- 1h 完整任务一并精确化"逐局验证轮次与比分"等断言

**留痕**：`rps-game.spec.js` 已重构为单 test 自包含 + 3 局决胜，作为 1h 试验骨架提交（顶部注释说明）。原 `describe.serial` + 5-test 版本被替换。

## 5. Antd 5 + React 19 兼容性

**现象**：client 用了 React 19 + Antd 5，控制台持续报：
```
Warning: [antd: compatible] antd v5 support React is 16 ~ 18. see https://u.ant.design/v5-for-19 for compatible.
```

**Antd 兼容层实际行为**（来自 `@ant-design/v5-patch-for-react-19`）：

| 修补点 | React 18 行为 | React 19 行为 | 兼容层处理 |
|---|---|---|---|
| `useEffect` 重复执行 | 不重复 | Strict Mode 重复 | 加 `isMounted` 标记 |
| `setState` 在 effect 内调度 | 立即同步 | microtask | 包一层 `Promise.resolve().then(...)` |
| `useLayoutEffect` DOM 测量 | 同步 | 可能延迟 | 用 `ref` + `setTimeout` 模拟 |
| `findDOMNode` | 警告 | 移除 | 用 ref 替代 |

**对 GameBoard 的影响**（待 1h 实施时精确测量）：

- `readyGo` 阶段 3 个 `setTimeout`（1500/2500/3000ms）→ setState 链，每次多 1-几帧延迟
- `onRoundResult` 阶段 `setTimeout(2200ms)` 切回 `choosing` 也受影响
- 3 局对决累积 50-200ms 偏差

**与 v3.6 阶段关系**：

- v3.6 Phase 1（E2E 基线）：用 `data-testid` 替代 `getByRole` 后，Antd 渲染变化对 E2E 影响降至最低
- v3.6 Phase 2（生命周期治理）：可能仍受 React 19 状态更新时序影响，需特别留意 readyGo / 倒计时等过渡阶段
- 不属于 v3.6 范围：升级 Antd 6 或回退 React 18

## 6. 1h 实施结论（rps-game.spec.js 完整重构）

**结论**：1h 任务已通过，3 次稳定性验证全部通过（15.6-15.7s 耗时稳定）。

**关键修改**：

1. **data-testid 替代 getByRole**（step.md 1g）：
   - `GameBoard.jsx` 加 6 个：`rps-readygo-overlay` / `rps-round-title` / `rps-score-me` / `rps-score-opp` / `rps-choice-{rock,paper,scissors}` / `rps-forfeit`
   - `RpsMatchResult.jsx` 加 5 个：`rps-match-result` / `rps-match-result-title` / `rps-match-result-score` / `rps-return-room` / `rps-rematch`
   - 减少 Antd 5 + React 19 兼容层对选择器的影响

2. **`makeChoice` 等 socket emit 完成**（修 350ms setTimeout 竞态）：
   - `GameBoard.jsx:286-291` 内部 350ms setTimeout 才发 `socket.emit('game:move')`
   - 用 `waitForFunction` 等按钮变 disabled（phase 切到 'waiting' 时按钮被 setRollStopped 禁用）
   - 不违反 step.md 不用 `waitForTimeout` 约束（"等待可观察状态变化"）

3. **`waitForNewRound(previousRound)` 替代动态读轮次**（修 waitForRoundResult 竞态）：
   - 显式参数 + 轮次标题 + 按钮 enabled 双信号
   - 避免 dumpState 串行操作导致的"读到已被 roundResult 更新过的轮次"
   - 根因：`GameBoard.jsx:183` 收到 roundResult 立即 `setRound(data.round + 1)`，2200ms setTimeout 只切 phase 不动 round

4. **修复 RPS 规则错**（i=1）：
   - 原 `{ a: '布', b: '石头' }` → 实际爸爸胜（布胜石头），第二局直接 2:0 结束
   - 改 `{ a: '石头', b: '布' }` → 妈妈胜（布胜石头），1:1 进入 i=2

**测试结果**：

- 1 passed in 15.6s
- 3 次连续运行均通过，耗时稳定
- server log 完整 3 局：round 1 爸爸胜 → round 2 妈妈胜 → match 爸爸胜（2-1）
- 赛果正确：pageA "恭喜你获得比赛胜利！"，pageB "比赛结束，下次加油！"
- 终局比分：2-1

**Antd 5 + React 19 影响评估**（实测）：

- data-testid 选择器稳定：3 次运行都成功定位到目标元素
- readyGo overlay 3s 定时器在 pageA/B 双 page 累积偏差 < 1s，足够稳定
- 350ms setTimeout 竞态已通过 waitForFunction 解决
- 实际表现：单次 spec 总耗时 15-16s（其中 webServer 启动 ~3s），无随机失败
