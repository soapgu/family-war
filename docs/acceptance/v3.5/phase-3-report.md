# v3.5 Phase 3：管理端认证服务切换报告

执行时间：2026-07-27

## 实施结果

- 管理端新增独立 `ADMIN_AUTH_API_BASE`，开发和生产均为 `/api/admin-auth`；
- `FAMILY_WAR_API_BASE` 继续保持开发 `/api`、生产 `/api/family-war`；
- 新增平台级 `adminAuthApi`，只提供登录、当前管理员和退出；
- `RequireAdminAuth` 启动时通过 `/api/admin-auth/me` 探测会话；
- 登录和主动退出分别使用 `/api/admin-auth/login`、`/logout`；
- family-war 模块 API 不再导出登录或退出方法；
- 业务请求返回 401 时只使前端会话失效，不重复调用退出接口；
- 主动退出即使遇到网络失败，也会清理前端认证状态并要求重新登录；
- 管理端不在 Local Storage、Session Storage 或响应体中保存 Token；
- family-war 状态、词库、图片和 TTS 页面 URL 与业务请求路径保持不变。

## Acceptance 配置边界

管理端验收现在分别要求：

```text
ACCEPTANCE_ADMIN_URL
ACCEPTANCE_AUTH_API_URL
ACCEPTANCE_API_URL
ACCEPTANCE_ADMIN_PASSWORD
```

续跑指纹升级到 schema 3，并加入认证 API 地址。网络边界断言要求：

- 认证请求只能访问 `/api/admin-auth/*`；
- family-war 业务管理请求只能访问 `/api/family-war/admin/*`；
- 拒绝 `/api/family-war/admin/login`、`/api/admin/login` 和 v3.2 旧 API；
- 继续拒绝任何 Socket.IO 请求；
- 浏览器验收改为检查 `admin_session` HttpOnly Cookie。

验收临时认证配置会同时写入指定管理员密码和本轮专用的 32 字节随机 JWT Secret，
结束后恢复整个原文件并重启 PM2。首次 SIGINT 也会执行“恢复配置、重启 PM2、等待健康”
后再退出，随机 Secret 不写入日志或报告。

## 自动化结果

| 项目 | 结果 |
|------|------|
| 管理端 Vitest | 14 个测试文件、59 项测试通过 |
| Acceptance 离线检查 | 7 个步骤及双 API 网络边界通过 |
| 管理端生产构建 | 通过 |
| JavaScript 语法检查 | 通过 |
| `git diff --check` | 通过 |

生产构建产物检查结果：

- 包含 `/api/admin-auth`；
- 包含 `/api/family-war`；
- 不包含 `/api/admin/login`、`/api/admin/logout`；
- 不包含 `/api/family-war/admin/login`、`admin_token` 或 `admin_session` 字符串。

Cookie 名称只由服务端 Set-Cookie 管理，业务构建不需要读取 Cookie，因此生产 JavaScript
中不包含 `admin_session` 是预期结果。

## 阶段边界

本阶段没有：

- 新增或重载 `/api/admin-auth/` Nginx location；
- 重启、部署 PM2 服务；
- 运行预发布 Playwright；
- 删除旧 API 或 Socket.IO location；
- 修改游戏端或 Socket.IO 协议。

服务端与管理端源码现已使用同一套 v3.5 认证协议，但在 Nginx 增加认证入口并完成预发布
验收前，不应部署到正式环境。
