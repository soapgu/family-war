# v3.3 Phase 4：Nginx 标准入口运行报告

执行时间：2026-07-24  
执行环境：本机预发布 `http://localhost:8080`  
服务端：PM2 `family-war-server`，端口 `4010`

## 1. 配置变更

生效配置：

`/opt/homebrew/etc/nginx/servers/conf.d/family-war.conf`

版本化副本：

`deploy/nginx/family-war.conf`

回滚备份：

`/opt/homebrew/etc/nginx/servers/conf.d/family-war.conf.v3.2-backup-20260724`

新增：

- `/api/family-war/` 直接代理到 `http://localhost:4010/api/`；
- `/socket/family-war/` 直接代理到 `http://localhost:4010/socket.io/`；
- 标准入口传递 Host、真实 IP、转发链和原始协议；
- 标准 Socket.IO 入口配置 HTTP/1.1、Upgrade、Connection 和 60 秒代理超时。

保留：

- `/family-war/api/`；
- `/family-war/socket.io/`；
- 两个旧入口均为直接代理，没有增加 301/302；
- 旧入口写入 `/opt/homebrew/var/log/nginx/family-war-legacy-access.log`，默认日志格式不包含 JWT Cookie 或请求体。

## 2. 配置检查

首次 `nginx -t` 发现相对日志目录指向不存在的 Cellar `logs/`，配置未重载，运行实例未受影响。

改用绝对日志路径后结果：

```text
nginx: the configuration file /opt/homebrew/etc/nginx/nginx.conf syntax is ok
nginx: configuration file /opt/homebrew/etc/nginx/nginx.conf test is successful
```

随后执行 `nginx -s reload` 成功。

## 3. HTTP 对照

| 入口 | 结果 |
|------|------|
| `GET /api/family-war/health` | 200，`application/json; charset=utf-8`，`{"status":"ok"}` |
| `GET /family-war/api/health` | 200，响应与标准入口一致 |
| `GET /family-war/` | 200，游戏页面可访问 |
| `GET /admin/` | 200，管理页面可访问 |

新旧 API 健康检查均无 Location 响应头，不依赖重定向。

## 4. 网关自动化结果

执行：

```bash
GATEWAY_BASE_URL=http://localhost:8080 npm run test:gateway
```

结果：

- 标准 API 与兼容 API 状态码、Content-Type 和业务响应一致；
- `/socket/family-war/` polling-only 连接与 `room:state` 事件往返通过；
- `/socket/family-war/` WebSocket-only 连接与事件往返通过；
- `/family-war/socket.io/` polling-only 兼容验收通过；
- `/family-war/socket.io/` WebSocket-only 兼容验收通过；
- 默写题目返回内部 `/api/images/*` 地址；
- 映射后的 `/api/family-war/images/spit` 返回 200 和图片 Content-Type；
- API 与图片检查均未经过 HTTP 重定向。

兼容日志已记录旧 API、polling 和 WebSocket 请求，其中 WebSocket 握手状态为 101。重载后未产生新的 Nginx 代理错误。

## 5. 环境说明

Nginx 的静态目录直接指向仓库的 `client/build/` 和
`admin-client/build/`。Phase 2 执行生产构建时，预发布静态产物已经随之更新，
因此 Phase 4 执行时无法再将页面认定为旧 v3.2 构建。

旧客户端兼容性通过旧 API、旧 Socket.IO polling 和旧 Socket.IO WebSocket
的真实网关测试证明。后续应避免把“生产构建”和“预发布部署”视为两个独立动作，
除非将 Nginx 静态目录改为独立发布目录。
