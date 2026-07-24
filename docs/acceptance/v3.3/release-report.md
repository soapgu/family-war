# v3.3.0 发布验收报告

执行时间：2026-07-24  
发布环境：本机 Nginx `http://localhost:8080`、PM2 `family-war-server`

## 自动化验证

| 项目 | 结果 |
|------|------|
| 服务端 Jest | 10 个测试套件、255 项测试通过 |
| 游戏端 Vitest | 10 个测试文件、87 项测试通过 |
| 管理端 Vitest | 5 个测试文件、25 项测试通过 |
| Socket.IO 集成 | 95 项断言通过 |
| 生产构建 | 游戏端、管理端均通过 |
| 构建隔离 | 两个前端可独立、重复构建 |
| Playwright acceptance | 6/6 通过 |
| 数据恢复 | 词库和图片恢复完成，`recovery.json` 不存在 |

Playwright 验收确认：

- 管理员登录、Cookie、登出和重新登录正常；
- 管理首页通过 `/api/family-war/admin/status` 获取状态；
- 词库修改、保存、刷新和原始配置恢复正常；
- 图片候选、替换、预览和原图哈希恢复正常；
- 1366×768、1440×900、1920×1080 均无布局溢出。

## 正式网关验证

`GATEWAY_BASE_URL=http://localhost:8080 npm run test:gateway` 通过：

- `/api/family-war/health` 与 `/family-war/api/health` 响应一致；
- 新旧 API 均不依赖重定向；
- `/socket/family-war/` polling-only 和 WebSocket-only 通过；
- `/family-war/socket.io/` polling-only 和 WebSocket-only 通过；
- 默写服务端相对图片地址可映射到 `/api/family-war/images/*`；
- 图片返回 200、正确 Content-Type 且不经过重定向。

`nginx -t` 通过，PM2 进程在线。

## 回滚演练

1. 从 `v3.2.0` 标签建立临时 worktree；
2. 使用 v3.2 源码重新构建游戏端和管理端；
3. 备份当前 v3.3 构建，短暂切换到 v3.2 构建；
4. 确认游戏页、管理页和旧 `/family-war/api/health` 正常；
5. 确认旧 Socket.IO polling/WebSocket 均可连接并完成事件往返；
6. 恢复 v3.3 构建；
7. 确认游戏构建包含 `/socket/family-war/`，管理构建包含 `/api/family-war`。

结论：前端可独立回滚至 v3.2，不需要回滚服务端或删除 v3.3 Nginx location。

## 兼容观察基线

兼容日志：

`/opt/homebrew/var/log/nginx/family-war-legacy-access.log`

发布前基线为 35 行，User-Agent 仅包含本轮验收产生的 `curl`、`node`、
`node-XMLHttpRequest` 和 WebSocket 空 User-Agent，尚无可识别的真实旧客户端流量。

观察规则：

- v3.3 整个运行周期持续保留旧入口；
- 统计时排除验收脚本、监控和扫描流量；
- 日志不记录 JWT Cookie 或请求体；
- 至少经过一个完整版本观察周期且没有真实客户端后，后续版本才能提出下线；
- Socket.IO 旧入口不使用 301/302 迁移。
