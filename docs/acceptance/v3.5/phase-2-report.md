# v3.5 Phase 2：服务端管理员认证拆分报告

执行时间：2026-07-27

## 实施结果

- 新增独立 `adminAuth` 路由模块，提供 `/api/admin-auth/login`、`/me`、`/logout`；
- 登录继续使用单一管理员密码和现有管理员 JWT Secret；
- 新会话仅设置 `admin_session` HttpOnly Cookie，不在响应体暴露 Token；
- JWT 验证同时检查签名、有效期、subject、role、tokenType、audience 和 issuer；
- `GET /api/admin-auth/me` 只返回最小管理员身份，不读取房间、比赛、词库或图片状态；
- 登录限流已切换到新登录路径；
- 登录、退出及 family-war 修改类管理请求继续执行生产同源校验；
- family-war 管理路由已移除登录和退出处理，只保留状态、词库和图片业务接口；
- 生产环境缺少管理员密码或 JWT Secret 时在服务启动前失败；
- 非生产环境缺少配置时允许服务启动，但认证接口返回 503，不再接受任意密码；
- 旧 `/api/admin/login` 和 `/api/admin/logout` 内部路由已不可用。

## Cookie 行为

`admin_session` 固定使用：

- `HttpOnly`；
- `SameSite=Lax`；
- `Path=/`；
- 24 小时过期；
- HTTPS 请求增加 `Secure`；
- 退出时使用相同属性幂等删除。

Koa 当前 Cookie 库将传入的 24 小时 `maxAge` 序列化为等价的 `Expires` 响应头，
测试按实际过期时间验证，不依赖必须出现 `Max-Age` 字段。

## 自动化结果

| 项目 | 结果 |
|------|------|
| 管理员认证定向测试 | 2 个套件、48 项通过 |
| 服务端完整 Jest | 11 个套件、273 项通过 |
| Socket.IO 集成 | 95 项断言通过 |
| 修改文件语法检查 | 通过 |
| `git diff --check` | 通过 |

新增或扩充的认证场景包括：

- 缺少、空白、非字符串和错误密码；
- 登录成功响应及 Cookie 属性；
- `me` 最小身份响应；
- 缺少、过期和篡改 Token；
- 错误 role、tokenType、subject、audience 和 issuer；
- 登录限流成功清除和失败累计；
- 跨源、无效 Origin 和同源 POST；
- HTTPS Secure Cookie；
- 缺少密码或 Secret 的生产启动检查与非生产 503；
- 旧登录和退出路由确认已移除；
- family-war 业务管理接口继续受新会话保护。

## 阶段边界

本阶段没有：

- 修改 Nginx 或重启 PM2；
- 部署服务端；
- 修改管理端请求路径；
- 删除公网 `/family-war/api/*` 或 `/family-war/socket.io/*`；
- 修改游戏 Socket.IO 协议。

当前源码中的服务端已只接受新认证接口和 `admin_session`。`admin-client` 仍使用 v3.4
认证路径，必须完成 Phase 3 切换后，才能把两者作为同一版本部署。
