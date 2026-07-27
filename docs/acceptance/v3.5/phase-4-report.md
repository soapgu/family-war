# v3.5 Phase 4：网关和自动化验收扩充报告

执行时间：2026-07-27

## 实施结果

- 网关测试分别接受认证 Base、family-war API Base 和 Socket.IO path；
- 新增 `GATEWAY_LEGACY_MODE=compatible|removed`，同一套脚本可用于切换前和下线后；
- 认证网关验收覆盖登录、`me`、退出和退出后的 401；
- 登录验收检查 `admin_session` 的 HttpOnly、SameSite、Path 和 HTTPS Secure 属性；
- 认证响应不要求也不输出 Token，测试日志不打印 Cookie 内容；
- 标准业务入口继续覆盖健康检查、拼写图片、Socket.IO polling-only 和 WebSocket-only；
- 旧入口下线模式要求旧 API 不得成功代理到 family-war，也不得以 301/302 重定向到标准入口；
- 旧 Socket.IO 下线模式同时验证 polling 握手和 WebSocket 连接失败。

网关测试的关键配置如下：

```text
GATEWAY_BASE_URL
GATEWAY_ADMIN_PASSWORD
GATEWAY_AUTH_BASE=/api/admin-auth
GATEWAY_API_BASE=/api/family-war
GATEWAY_SOCKET_PATH=/socket/family-war/
GATEWAY_LEGACY_MODE=compatible|removed
```

`compatible` 用于删除旧 Nginx location 前确认双路径仍可用；`removed` 用于删除后确认旧
API 和 Socket.IO 均未被代理或重定向。认证密码为运行时必需输入，但不会出现在测试输出中。

## Playwright 认证验收

管理端认证步骤新增以下行为验证：

- 登录成功后取得 `admin_session`，并检查 Cookie 安全属性；
- 刷新管理页面后会话仍保持，`me` 返回管理员身份；
- 登出会等待真实 `/api/admin-auth/logout` 响应，并确认 Cookie 被删除；
- 登出后直接请求 `me` 返回 401；
- 连续错误登录触发 429 限流；
- 重启服务清理当前内存限流状态后，可使用正确密码重新登录。

限流恢复步骤依赖验收环境的 PM2 控制权限。它验证的是当前“进程内限流器”契约，不将
服务重启描述为面向最终用户的恢复方式。验收运行器仍会在结束或首次中断时恢复完整本地
配置、重启服务并等待健康，临时密码和随机 JWT Secret 不写入报告。

## 自动化结果

| 项目 | 结果 |
|------|------|
| 服务端 Jest | 11 个测试套件、273 项测试通过 |
| 游戏端 Vitest | 10 个测试文件、87 项测试通过 |
| 管理端 Vitest | 14 个测试文件、59 项测试通过 |
| Socket.IO 集成测试 | 95 项断言通过 |
| Acceptance 离线检查 | 7 个步骤及网关配置检查通过 |
| 网关兼容模式配置检查 | 通过 |
| 网关下线模式配置检查 | 通过 |
| 完整生产构建 | 通过 |
| 构建隔离验证 | 通过 |
| JavaScript 语法检查 | 通过 |
| `git diff --check` | 通过 |

两个前端生产构建仍有既存的单 chunk 超过 500 kB 提示，不影响构建和隔离验证结果。

## 阶段边界

本阶段扩充的是可执行的网关和浏览器验收能力，没有：

- 修改或重载真实 Nginx 配置；
- 删除旧 API 或 Socket.IO location；
- 部署服务端或管理端生产构建；
- 对预发布环境运行需要密码的真实网关验收；
- 运行会重启预发布 PM2 的完整 Playwright acceptance。

真实 Nginx 下的认证、标准入口、旧入口下线和限流恢复将在 Phase 5 按切换顺序执行。
