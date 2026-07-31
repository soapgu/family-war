# v3.6 E2E 装配说明（1c 产物）

> 本文件说明 Phase 1 Playwright E2E 装配的服务启动前置条件、诊断产物和本地调试方式。与 step.md 1c 对齐。

## 1. 服务启动前置条件

E2E 默认假设以下服务已运行（开发约定）：

- **client**：Vite 开发服务器，端口 3000，base path `/family-war/`
- **server**：Koa + Socket.IO，端口 4000
- **admin-client**：本阶段不使用，可不启动

启动方式（在仓库根目录）：

```bash
# 方式一：同时启动全部（推荐）
npm run dev

# 方式二：仅启动 E2E 所需（节省资源）
npm run server &     # 后台启动 server
npm run client &     # 后台启动 client
```

**禁止**：

- ~~在 pm2 预发布环境运行期间同时启动本地 E2E 服务（端口冲突，先 `pm2 stop family-war-server`）~~ **已修正**：E2E 使用 4000（开发），预发布使用 4010（pm2），两端口完全分离，无冲突。详见 §12 端口对照。
- 同一项目同时跑 `npm run dev` 和 `yarn dev`（多组并发会留下残留进程）

## 2. Base URL 配置

E2E 通过 `baseURL` 定位 client：

- 默认：`http://localhost:3000/family-war/`（与 `client/vite.config.js` `base: '/family-war/'` 一致）
- 覆盖：环境变量 `CLIENT_BASE_URL`

```bash
CLIENT_BASE_URL=http://localhost:3001/family-war/ npm run test:e2e
```

## 3. 超时与重试

- 测试总超时：60 秒
- 单个 `expect` 超时：15 秒
- 不使用 `waitForTimeout` 推测业务完成
- 不重试（Playwright 默认 `retries: 0`）

## 4. 失败诊断产物

失败时自动收集：

| 产物 | 路径 | 触发条件 |
|---|---|---|
| 失败截图 | `client/tests/e2e/test-results/*/test-failed-*.png` | `screenshot: 'only-on-failure'` |
| Trace | `client/tests/e2e/test-results/*/trace.zip` | `trace: 'retain-on-failure'` |
| HTML 报告 | `client/tests/e2e/e2e-report/index.html` | 始终生成，`open: 'never'` |
| JSON 结果 | `client/tests/e2e/test-results/e2e-results.json` | 始终生成，用于覆盖数量和耗时统计 |
| 页面诊断附件 | `client/tests/e2e/test-results/*/` | 公共 fixture 注册 `pageerror`/`console.error`/`requestfailed`/WebSocket 监听，失败时附加 JSON |
| Node Socket 诊断 | `client/tests/e2e/test-results/*/` | 无 UI 权限问题失败时附加连接、`connect_error` 和 `disconnect` 诊断 |

Node Socket 权限问题不创建 Page，因此没有页面截图和 Trace；连接级 JSON 诊断是该受控例外的等价失败产物。

## 5. 诊断附件脱敏规则

页面诊断由 1e 公共 fixture 在 `client/tests/e2e/fixtures/index.js` 中实现，Node Socket 诊断在 `client/tests/e2e/lifecycle/socketClient.js` 中实现。脱敏字段（不允许写入诊断附件）：

- `cookie`、`set-cookie`、`authorization` 请求头
- `localStorage`、`sessionStorage` 全部内容
- Socket.IO `auth` 字段、token
- 玩家昵称（仅保留前缀 `e2e-` 与长度，便于追踪但不暴露真实身份）
- Socket.IO 业务事件 Payload 和完整答案

非阻断噪声清单（允许在 `diagnostics.json` 中标记 `nonBlocking: true`，不计入失败判定）：

- Vite HMR 客户端连接信息
- React DevTools 提示
- 其他经 1e 评审明确的"已知噪声"项

## 6. 本地调试方式

```bash
# 6.1 有头模式（看到浏览器）
HEADED=1 npm run test:e2e

# 6.2 单 spec 调试
npx playwright test tests/e2e/rps-game.spec.js --config playwright.config.js

# 6.3 Playwright UI 模式（推荐）
npm run test:e2e:ui

# 6.4 调试模式（断点）
PWDEBUG=1 npm run test:e2e
```

## 7. CI 注意事项

- 必须先在 CI 任务中 `npm run build` + 启动对应服务，或后续补 `webServer` 配置自动启停
- 不在 CI 跑有头模式
- HTML 报告 `open: 'never'`
- 失败产物（截图/Trace/诊断附件）作为 CI artifact 上传

## 8. 命令清单

| 命令 | 用途 |
|---|---|
| `npm run test:e2e` | 跑全部 E2E（单 worker 串行）|
| `npm run test:e2e:headed` | 有头模式（本地调试）|
| `npm run test:e2e:check` | 列出所有 spec 不实际运行 |
| `npm run test:e2e:report` | 打开 HTML 报告 |
| `npm run test:e2e:stable` | 只跑 `@stable` Tag（Phase 1 稳定基线，纳入 1s 三次连续执行）|
| `npm run test:e2e:lifecycle` | 只跑 `@lifecycle-issue` Tag（问题基线，**不**纳入 1s）|
| `npm run test:e2e:check:stable` | 离线列出 `@stable`，预期 11 个测试 |
| `npm run test:e2e:check:lifecycle` | 离线列出 `@lifecycle-issue`，预期 3 个测试 |
| `npm run test:e2e:check:untagged` | 离线列出未分类测试，预期 0 个测试 |
| `npm run test:e2e:ui` | Playwright UI 模式（推荐调试方式）|

`@stable` / `@lifecycle-issue` Tag 只通过 Playwright `test` 的 `tag` 配置声明，不写入测试标题。每个场景必须且只能属于一个分组：

- `@stable`：当前正确且必须通过的浏览器行为，纳入 1s 三次连续执行；
- `@lifecycle-issue`：生命周期治理输入；已知缺陷使用目标行为断言和 `test.fail()`，不纳入 1s。

无 UI 入口的服务端权限缺陷可在 `@lifecycle-issue` 中使用 Node `socket.io-client` 连接真实服务做最小复现。该例外不得用于 `@stable`、主链路或存在公开 UI 入口的场景；缺陷修复后应迁入服务端集成测试。

## 9. 与 1a 矩阵的对应

- E2E 范围：test-matrix.md 二·2.1 缺口矩阵 22 行
- E2E 装配参数：本文 § 2-4
- 1e 页面诊断实现：`client/tests/e2e/fixtures/index.js`
- Node Socket 诊断实现：`client/tests/e2e/lifecycle/socketClient.js`
- 1s 三次连续执行：仅针对 `npm run test:e2e:stable`

## 10. Playwright webServer 自管（1c-Phase-0 升级）

参考 `soapgu/that-math-things@4413100` Phase 0 设计：`client/playwright.config.js` 通过 Playwright `webServer` 自动启停 client + server 进程：

- `command: 'npm run dev:server'`（server，使用 `node src/index.js` 而非 nodemon）
- `command: 'npm run dev:client'`（client，使用 `vite` 默认 dev）
- `url` 探测：server 用 `http://127.0.0.1:4000/api/health`（200 + JSON），client 用 `http://127.0.0.1:3000/family-war/`（Vite SPA fallback）
- `reuseExistingServer: !process.env.CLIENT_BASE_URL`：未提供 `CLIENT_BASE_URL` 时不静默复用 3000/4000 上的未知服务
- `timeout`：server 30s、client 60s（Vite optimize deps 较慢）

`CLIENT_BASE_URL` 显式提供时（开发者自管服务场景）：

- `webServer` 不创建
- Playwright 不终止该外部进程
- 可连接任意来源的 server/client 服务

## 11. 完成标准（对齐 that-math-things Phase 0）

1. 未预先 `npm run dev` 时，`npm run test:e2e` 独立完成（Playwright 自管 client + server 进程）
2. 测试期间 3000 / 4000 端口固定，端口冲突立即失败并提示
3. 测试正常结束 / 失败 / 中断后，Playwright 启动的 server 与 client 不再监听 3000 / 4000
4. 3000 / 4000 已被占用时测试明确失败，给出"旧实例"提示
5. 设置 `CLIENT_BASE_URL` 后可连接外部服务，Playwright 不终止该外部进程
6. 不在 npm 脚本中用 `pkill` / `kill` 强制清理

## 12. 端口对照（事实更正留痕）

| 用途 | 端口 | 启动方式 | 文档 |
|---|---|---|---|
| 开发 | 4000 | `npm run server` / `npm run dev` | `step.md` Step 2、`README.md` |
| E2E | 4000 | Playwright `webServer` | 本文件 §10 |
| 预发布 | 4010 | PM2 `family-war-server` | `step.md` Step 2、`docs/acceptance/v3.3/phase-4-nginx-report.md` |

> 注：1c 实施过程中曾误判"pm2 占用 4000"，实际 `pm2 jlist` 显示 `pm2_env.PORT = 4010`；4000 始终是开发端口。详见 `docs/acceptance/v3.6/notes.md`（待留痕）。
