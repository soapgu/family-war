# v3.5 Phase 5：预发布切换、旧入口下线与回滚演练报告

执行时间：2026-07-27  
预发布环境：本机 Nginx `http://localhost:8080`、PM2 `family-war-server`

## 1. 最终状态

- PM2 在线，脚本路径为当前仓库 `server/src/index.js`，内部端口 4010；
- Nginx 生效配置与 `deploy/nginx/family-war.conf` 完全一致；
- `/api/admin-auth/` 已启用；
- `/api/family-war/`、`/socket/family-war/` 保持启用；
- `/family-war/api/`、`/family-war/socket.io/` 已删除；
- 管理端与游戏端生产构建已更新；
- Acceptance 没有待恢复状态，本地认证配置已恢复。

## 2. 路径与认证矩阵

| 项目 | 最终结果 |
|------|----------|
| `/api/admin-auth/login` | 200，设置 `admin_session` |
| `/api/admin-auth/me` | 携带 Cookie 返回最小管理员身份 |
| `/api/admin-auth/logout` | 200，删除 `admin_session` |
| `admin_session` | HttpOnly、SameSite=Lax、Path=/；本机 HTTP 不设置 Secure |
| 登录响应 | 不返回 JWT Token |
| `/api/family-war/health` | 200，无重定向 |
| `/api/family-war/images/*` | 200，图片 Content-Type 正确 |
| `/socket/family-war/` polling | 连接和事件往返通过 |
| `/socket/family-war/` WebSocket | 连接和事件往返通过 |
| `/family-war/api/*` | 不再代理，不进行 301/302 |
| `/family-war/socket.io/*` | polling/WebSocket 均不可连接，不进行 301/302 |

管理端 Playwright 网络边界检查确认只使用 `/api/admin-auth/*` 和
`/api/family-war/*`，没有旧 API、Socket.IO 请求或浏览器可读 Token。

## 3. 自动化验收结果

| 项目 | 结果 |
|------|------|
| 切换前网关 `compatible` 模式 | 通过 |
| 切换后网关 `removed` 模式 | 多次复验通过 |
| 管理端 Playwright acceptance | 切换前后均为 7/7 通过 |
| 游戏端 Playwright E2E | 8/8 通过 |
| 完整生产构建 | 通过 |
| 构建隔离验证 | 通过 |
| `nginx -t` | 每次修改及回滚均通过 |
| PM2 最终状态 | online，当前工作区，0 次非演练重启 |
| PM2 服务错误日志 | 最终无业务异常 |

两个前端仍有既存的单 chunk 超过 500 kB 构建提示，不影响产物和验收结果。

Nginx 错误日志中出现的短暂 upstream connection refused 均与验收脚本或认证回滚演练
主动重启 PM2 的时间窗口一致；服务恢复后的最终 `removed` 网关验收全部通过，没有持续
代理错误、循环重定向或 Socket.IO 握手异常。

## 4. 旧入口清理门槛

删除前日志由 68 行增至 79 行，新增 11 行全部由本轮 `compatible` 网关验收产生：

- 来源全部为 `127.0.0.1`；
- User-Agent 为 `node`、`node-XMLHttpRequest` 或 WebSocket 空值；
- 没有浏览器、外部地址或无法归因的真实客户端请求。

回滚演练结束后日志共 91 行，新增内容仍全部可归因于分步下线检查和兼容回滚测试。
预发布旧入口清理门槛通过。

## 5. 旧入口回滚演练

演练只恢复 `deploy/nginx/family-war-legacy-locations.conf` 所定义的两个 location：

1. 恢复旧 API 和旧 Socket.IO；
2. `nginx -t` 与重载通过；
3. `compatible` 网关验证旧 API、polling、WebSocket 全部恢复；
4. 标准认证、API、图片和 Socket.IO 同时保持正常；
5. 再次删除两个旧 location；
6. `removed` 网关确认旧入口重新下线。

单次 Nginx 配置切换和网关验证命令在 1 秒内完成。该演练没有切换服务端或前端版本。

## 6. 管理员认证回滚演练

为避免覆盖当前工作区，使用 `v3.4.0` 标签在独立临时目录构建和运行：

1. PM2 临时切换到 v3.4 服务端；
2. `/admin/` 临时指向 v3.4 管理端构建；
3. 旧 `/api/family-war/admin/login` 返回成功并设置 `admin_token`；
4. 无头浏览器通过 v3.4 管理页面重新登录；
5. PM2、管理端和 Nginx 恢复当前 v3.5；
6. 新登录设置 `admin_session`，旧认证接口返回 404；
7. 没有数据库迁移、Cookie 转换或配置残留。

从开始切换 v3.4 到浏览器登录验证约 43 秒；恢复 v3.5 并等待健康约 11 秒。临时副本
保留在 `/private/tmp/family-war-v35-auth-rollback-v34`，仅用于本轮回滚证据，可在版本
发布完成后删除。

## 7. 正式发布批准条件

预发布层面的批准条件全部满足，可以进入 Phase 6，但正式发布仍必须：

1. 先部署服务端和 `/api/admin-auth/`，验证标准入口；
2. 再部署管理端，确认管理员重新登录；
3. 最后复核正式环境旧入口日志，分步删除旧 API 和旧 Socket.IO；
4. 每次 Nginx 修改前执行 `nginx -t`；
5. 正式环境重新执行 acceptance、游戏端 E2E 和 `removed` 网关验收；
6. 若出现真实旧客户端，立即恢复两个旧 location，不回滚 v3.5 认证；
7. 若新认证异常，按独立认证回滚流程恢复 v3.4 服务端和管理端。
