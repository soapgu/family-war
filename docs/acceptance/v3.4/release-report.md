# v3.4.0 发布验收报告

执行时间：2026-07-26  
发布环境：本机 Nginx `http://localhost:8080`、PM2 `family-war-server`

## 版本与范围

- 根项目、游戏端、管理端和服务端版本统一为 `3.4.0`；
- 本版本完善 `admin-client` 平台框架，不改变 Koa 路由、JWT Cookie、游戏协议、
  Socket.IO 事件或 PM2 配置；
- 管理端继续使用 `/api/family-war/*`，不安装或连接 Socket.IO；
- 旧 `/family-war/api/*` 和 `/family-war/socket.io/*` 继续保留到 v3.5；
- 本版本不包含认证后端解耦、多管理员权限或微信认证。

## 最终自动化门禁

| 项目 | 结果 |
|------|------|
| 服务端 Jest | 10 个测试套件、255 项测试通过 |
| 游戏端 Vitest | 10 个测试文件、87 项测试通过 |
| 管理端 Vitest | 13 个测试文件、54 项测试通过 |
| Socket.IO 集成 | 95 项断言通过 |
| Playwright acceptance | 7/7 通过 |
| 生产构建 | 游戏端、管理端均通过 |
| 构建隔离 | 两个前端可独立、重复构建 |
| Acceptance 离线检查 | 管理端 7 步与网关矩阵检查通过 |

发布门禁期间修正了游戏端 Vitest 的测试发现范围，明确排除
`client/tests/e2e/**`，避免 Vitest 错误执行 Playwright 测试文件。该变更不影响游戏
运行代码。

## 正式环境验证

- Nginx 直接读取本次生成的 `client/build/` 和 `admin-client/build/`；
- `/admin/`、Family War 模块、词库深层路由和明确 404 已由相同构建哈希的
  Playwright acceptance 验证；
- `nginx -t` 通过；
- PM2 `family-war-server` 状态为 `online`；
- `/api/family-war/health` 与 `/family-war/api/health` 返回一致且无重定向；
- 新旧 Socket.IO 入口的 polling-only、WebSocket-only 均完成连接和事件往返；
- 标准默写图片入口返回 200 和图片 Content-Type。

## 兼容观察与 v3.5

v3.3—v3.4 旧入口日志排除发布、验收和自动化流量后，没有发现真实旧客户端。
v3.5 可以执行旧 API 与 Socket.IO location 清理，但清理前仍需检查日志增量、备份
配置，并保留可快速恢复旧 location 的回滚方案。Socket.IO 旧入口不得改成 301/302。

兼容观察详情见
[`phase-5-report.md`](./phase-5-report.md)。
