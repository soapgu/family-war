# v3.5 旧公网入口清理门槛结论

检查时间：2026-07-27  
日志：`/opt/homebrew/var/log/nginx/family-war-legacy-access.log`

## 1. 观察范围

- v3.3 基线和发布观察：2026-07-24；
- v3.4 验收和发布观察：2026-07-26；
- v3.5 Phase 1 增量复核：2026-07-27；
- 日志仅记录旧 `/family-war/api/*` 和 `/family-war/socket.io/*` location；
- 默认 Nginx 日志格式不记录 JWT Cookie 或请求体。

## 2. 最新统计

当前日志共 68 行：

| 类型 | 行数 |
|------|------|
| 旧 API `/family-war/api/*` | 8 |
| 旧 Socket.IO `/family-war/socket.io/*` | 60 |

与 v3.4 Phase 5 的 57 行相比新增 11 行，全部发生于 2026-07-26 11:28:40：

- 1 次旧 API 健康检查；
- 10 次 Socket.IO polling/WebSocket 网关验收请求。

全部 68 行来源均为 `127.0.0.1`。可见 User-Agent 仅为 `curl/8.7.1`、`node`、
`node-XMLHttpRequest`，WebSocket 请求为空 User-Agent。这些特征与 v3.3—v3.4
发布、回滚演练和 `server/tests/gateway.js` 自动化一致。

未发现：

- 非回环地址；
- 浏览器 User-Agent；
- `/admin/` 或 `/family-war/` 页面产生的旧入口请求；
- 无法归因到发布、验收、监控或扫描的真实客户端流量。

## 3. 门槛逐项判断

| 门槛 | 结果 | 依据 |
|------|------|------|
| 覆盖至少一个完整版本观察周期 | 通过 | v3.3、v3.4 两个版本均完成观察 |
| 排除项目验收、监控和扫描流量 | 通过 | 来源、时间、路径和 User-Agent 与自动化相符 |
| 无可识别真实 v3.2 客户端 | 通过 | 68 行均为回环自动化流量 |
| 标准 API、图片、polling、WebSocket 已验证 | 通过 | v3.4 Phase 5 和发布报告 |
| 旧 location 有可恢复备份 | 通过 | `deploy/nginx/family-war-legacy-locations.conf` |
| 清理后自动化可验证旧入口不可用 | 待 Phase 4 | 网关测试尚未切换为下线断言 |

## 4. Phase 1 结论

从访问观察角度，允许 v3.5 在预发布进入旧入口清理流程。实际删除前仍必须：

1. 再检查一次日志增量；
2. 先验证 `/api/admin-auth/*`、`/api/family-war/*`、图片和标准 Socket.IO；
3. 执行 `nginx -t`；
4. 先删旧 API 并验证，再删旧 Socket.IO 并验证；
5. 确认旧入口没有 301/302；
6. 完成旧 location 恢复演练。

如果删除前出现任何无法排除的真实旧客户端，暂停旧入口清理，但不阻塞管理员认证解耦。
