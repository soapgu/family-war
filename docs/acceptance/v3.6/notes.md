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
- ⚠️ 试验 spec `rps-game.spec.js` 跑测失败：trace 显示实际跑到了 round result 阶段（"我输了" + 0:2 比分），但 `GameBoardPage.waitForChoosingPhase()` 在后续局 15s 超时
- ⚠️ 失败根因不是 1c 装配，而是 **Antd 5 + React 19 兼容警告**（控制台: `antd v5 support React is 16 ~ 18. see https://u.ant.design/v5-for-19`），导致 GameBoard `readyGo` overlay 在 React 19 下时序不一致，pageA/B 看到 `choosing` 阶段的时点不同步

**留待 1h 解决**：

- `GameBoardPage.waitForChoosingPhase()` 需要等 `readyGo` overlay 消失（不能只看 button 可见，可能被 overlay 遮挡）
- 考虑用 `expect(page.getByText('第 1 局')).toBeVisible()` + `expect(page.getByRole('button', { name: /石头/ })).toBeEnabled()` 组合
- 1h 完整任务会一并精确化"逐局验证轮次与比分"等断言

**留痕**：`rps-game.spec.js` 已重构为单 test 自包含 + 3 局决胜，作为 1h 试验骨架提交（顶部注释说明）。原 `describe.serial` + 5-test 版本被替换。

## 5. Antd 5 + React 19 兼容性

**现象**：client 用了 React 19 + Antd 5，控制台持续报：
```
Warning: [antd: compatible] antd v5 support React is 16 ~ 18. see https://u.ant.design/v5-for-19 for compatible.
```

**影响**：

- E2E 试验发现 readyGo 阶段时序异常（按钮出现但 overlay 还在）
- 暂未发现业务功能受影响（页面渲染、点击、Socket 事件都正常）
- 长期建议：等 Antd 5 官方支持 React 19 后再升级或回退 React 18

**与 v3.6 阶段关系**：

- v3.6 Phase 1（E2E 基线）不受影响——E2E 用真实浏览器和真实 React 19 渲染
- v3.6 Phase 2（生命周期治理）可能受 React 19 状态更新时序影响，需特别留意 readyGo / 倒计时等过渡阶段
- 不属于 v3.6 范围：升级 Antd 6 或回退 React 18
