# v3.5 旧入口与认证回滚清单

本文件冻结回滚步骤，不在 Phase 1 执行 Nginx 修改或服务切换。

## 1. 回滚资产

- 当前版本化 Nginx 配置：`deploy/nginx/family-war.conf`；
- 旧入口恢复片段：`deploy/nginx/family-war-legacy-locations.conf`；
- 生效配置：`/opt/homebrew/etc/nginx/servers/conf.d/family-war.conf`；
- 兼容日志：`/opt/homebrew/var/log/nginx/family-war-legacy-access.log`；
- 服务进程：PM2 `family-war-server`，内部端口 4010。

恢复片段包含：

- `/family-war/api/` 直接代理到 `http://localhost:4010/api/`；
- `/family-war/socket.io/` 直接代理到 `http://localhost:4010/socket.io/`；
- Socket.IO HTTP/1.1、Upgrade 和 Connection 请求头；
- 独立兼容访问日志；
- 不包含任何 301/302。

## 2. 仅恢复旧公网入口

适用于 v3.5 标准入口正常、但发现仍有真实 v3.2 客户端的情况。

1. 备份当前生效配置；
2. 将 `family-war-legacy-locations.conf` 中两个 location 放回站点 server 块；
3. 确认没有重复 location；
4. 执行 `nginx -t`，失败时不得重载；
5. 语法通过后执行 `nginx -s reload`；
6. 验证旧 API 健康检查为 200 且没有 Location 响应头；
7. 分别验证旧 Socket.IO polling-only 和 WebSocket-only 直接连接；
8. 再验证所有标准入口仍正常；
9. 在回滚报告记录原因、时间、日志证据和恢复耗时。

## 3. 管理员认证回滚

适用于新认证接口或 `admin_session` 出现问题的情况。

1. 恢复 v3.4 服务端代码和管理端构建；
2. 确认 `/api/family-war/admin/login`、`/admin/status`、`/admin/logout` 可用；
3. 如已移除 `/api/admin-auth/` Nginx location，可在管理端回滚验证后移除；
4. 管理员使用原密码重新登录并获得 `admin_token`；
5. 不尝试转换、复制或复用 `admin_session`；
6. 验证状态、词库、图片、TTS、刷新保持和登出；
7. 若同时回滚到 v3.2 前端，必须一并执行旧公网入口恢复。

本版本无数据库迁移，回滚不需要数据转换。

## 4. 回滚后验收矩阵

| 项目 | 仅恢复旧入口 | 认证回滚 |
|------|--------------|----------|
| `/api/family-war/*` | 必须正常 | 必须正常 |
| `/socket/family-war/*` polling/WebSocket | 必须正常 | 必须正常 |
| `/family-war/api/*` | 恢复为 200 | 按前端回滚版本决定 |
| `/family-war/socket.io/*` | 恢复直接连接 | 按前端回滚版本决定 |
| `/api/admin-auth/*` | 保持 v3.5 | 可移除 |
| 管理员 Cookie | `admin_session` | 重新签发 `admin_token` |
| 301/302 迁移 | 禁止 | 禁止用于 Socket.IO |
